const { createApp, ref, reactive, nextTick } = Vue;

createApp({
    data() {
        return {
            currentView: 'user', // 'user' or 'admin'
            map: null,
            droneMarker: null,
            
            // User Platform State
            userState: {
                step: 0, // 0: Dispatching, 1: Picked up, 2: Delivering, 3: Arrived
                eta: 12, // minutes
                isRecycled: false,
                simulationInterval: null
            },

            // Admin Platform Data
            adminData: {
                activeTasks: [
                    { id: 101, droneId: 'DR-882', status: '配送中', eta: 3, distance: 1.2 },
                    { id: 102, droneId: 'DR-905', status: '返航中', eta: 8, distance: 4.5 }
                ],
                stats: {
                    dronesAvailable: 42,
                    dronesTotal: 50,
                    aedsAvailable: 156,
                    aedsTotal: 160
                },
                alerts: [
                    { id: 1, lat: 30.658, lng: 104.065, location: '天府广场地铁站C口', description: '突发心脏骤停', time: '10:42' },
                    { id: 2, lat: 30.628, lng: 104.075, location: '四川大学望江校区', description: '昏迷倒地', time: '10:45' }
                ]
            }
        };
    },
    mounted() {
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize(true);
            }
        });
    },
    methods: {
        async switchView(view) {
            this.currentView = view;
            
            // Wait for DOM update then init map
            await nextTick();
            
            if (view === 'user') {
                this.initUserMap();
                this.startUserSimulation();
            } else if (view === 'admin') {
                this.initAdminMap();
            }
        },

        // --- User Platform Logic ---
        initUserMap() {
            if (this.map) {
                this.map.remove();
                this.map = null;
            }

            // 使用 setTimeout 确保 DOM 完全渲染
            setTimeout(() => {
                const mapContainer = document.getElementById('user-map');
                if (!mapContainer) return;

                // Chengdu Coordinates (User at Tianfu Square area)
                const userLoc = [30.6570, 104.0665];
                const droneStart = [30.6700, 104.0750]; // Nearby station

                this.map = L.map('user-map', {
                    fadeAnimation: true,
                    zoomAnimation: true
                }).setView(userLoc, 14);

                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 19,
                    updateWhenIdle: false,
                    keepBuffer: 2,
                    detectRetina: true
                }).addTo(this.map);

                // 核心修复：强制重绘地图尺寸
                setTimeout(() => {
                    this.map.invalidateSize(true);
                }, 400);

                // User Marker (Pulse effect)
                const userIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: "<div style='background-color:#ef4444; width:15px; height:15px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px rgba(239,68,68,0.5);'></div><div class='pulse-ring' style='top:-2.5px; left:-2.5px;'></div>",
                    iconSize: [15, 15],
                    iconAnchor: [7.5, 7.5]
                });
                L.marker(userLoc, { icon: userIcon }).addTo(this.map).bindPopup("您的位置").openPopup();

                // Drone Marker
                const droneIcon = L.divIcon({
                    html: '<i class="fa-solid fa-plane text-blue-600 text-xl" style="transform: rotate(-45deg);"></i>',
                    className: 'drone-icon',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                this.droneMarker = L.marker(droneStart, { icon: droneIcon }).addTo(this.map);

                // Path
                const path = [droneStart, userLoc];
                L.polyline(path, { color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.6 }).addTo(this.map);

                this.loadAEDData();
            }, 50);
        },

        startUserSimulation() {
            // Reset state
            this.userState.step = 0;
            this.userState.eta = 20;
            this.userState.isRecycled = false;
            this.userState.recycleStatus = 0;

            if (this.userState.simulationInterval) clearInterval(this.userState.simulationInterval);

            // Simulation Loop
            this.userState.simulationInterval = setInterval(() => {
                if (this.userState.eta > 0) {
                    this.userState.eta--;
                    
                    // Simulate drone movement (interpolate)
                    if (this.map && this.droneMarker) {
                        const currentLatLng = this.droneMarker.getLatLng();
                        const targetLatLng = L.latLng(30.6570, 104.0665); // User loc in Chengdu
                        
                        const lat = currentLatLng.lat + (targetLatLng.lat - currentLatLng.lat) * 0.05;
                        const lng = currentLatLng.lng + (targetLatLng.lng - currentLatLng.lng) * 0.05;
                        
                        this.droneMarker.setLatLng([lat, lng]);
                    }

                    // Update steps based on ETA
                    if (this.userState.eta <= 16 && this.userState.step === 0) {
                        this.userState.step = 1; // Picked up
                    }
                    if (this.userState.eta <= 12 && this.userState.step === 1) {
                        this.userState.step = 2; // Delivering
                    }
                } else {
                    this.userState.step = 3; // Arrived
                    clearInterval(this.userState.simulationInterval);
                }
            }, 2000); // Slower simulation: 2 sec = 1 min
        },

        getProgressWidth() {
            // 0 -> 0%, 1 -> 33%, 2 -> 66%, 3 -> 100%
            return (this.userState.step / 3) * 100;
        },

        getStatusText() {
            const texts = [
                "无人机正在前往AED站点取货",
                "成功取货，正在飞往您的位置",
                "无人机即将到达，请保持电话畅通",
                "AED已送达，请立即取用！"
            ];
            return texts[this.userState.step] || "处理中...";
        },

        recycleAED() {
            if (confirm('确认已使用完毕并归还设备？')) {
                this.userState.recycleStatus = 1;
                alert('请在原地等待回收车辆');
                
                // Simulate vehicle arrival time (e.g. 5 seconds)
                setTimeout(() => {
                    this.userState.recycleStatus = 2;
                    this.userState.isRecycled = true;
                }, 5000);
            }
        },

        // --- Admin Platform Logic ---
        initAdminMap() {
            if (this.map) {
                this.map.remove();
                this.map = null;
            }

            // 使用 setTimeout 确保 DOM 完全渲染
            setTimeout(() => {
                const mapContainer = document.getElementById('admin-map');
                if (!mapContainer) return;

                // Center on Chengdu
                const center = [30.6570, 104.0665];
                this.map = L.map('admin-map', {
                    fadeAnimation: true,
                    zoomAnimation: true
                }).setView(center, 11); // Zoom out a bit to see more districts

                // Dark theme map
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 19,
                    updateWhenIdle: false,
                    keepBuffer: 2,
                    detectRetina: true
                }).addTo(this.map);

                // 核心修复：强制重绘地图尺寸
                setTimeout(() => {
                    this.map.invalidateSize(true);
                }, 400);

                // Add Stations from Excel Data
                const stations = [
                    { name: "郫都区站点", lat: 30.7958, lng: 103.8674 },
                    { name: "郫都区站点 (备用)", lat: 30.8422, lng: 103.9551 },
                    { name: "温江区站点", lat: 30.715, lng: 103.856 },
                    { name: "温江区站点 (备用)", lat: 30.655, lng: 103.81 },
                    { name: "双流区站点", lat: 30.508, lng: 103.918 },
                    { name: "双流区站点 (备用)", lat: 30.445, lng: 104.08 },
                    { name: "新津区站点", lat: 30.428, lng: 103.888 },
                    { name: "天府新区站点", lat: 30.393, lng: 104.118 },
                    { name: "天府新区站点 (备用)", lat: 30.25, lng: 104.258 },
                    { name: "龙泉驿区站点", lat: 30.603, lng: 104.18 },
                    { name: "龙泉驿区站点 (备用)", lat: 30.645, lng: 104.305 },
                    { name: "青白江区站点", lat: 30.828, lng: 104.378 },
                    { name: "青白江区站点 (备用)", lat: 30.9, lng: 104.3 },
                    { name: "新都区站点", lat: 30.82, lng: 104.155 },
                    { name: "新都区站点 (备用)", lat: 30.88, lng: 104.25 },
                    { name: "青羊区站点", lat: 30.678, lng: 103.962 },
                    { name: "青羊区站点 (备用)", lat: 30.665, lng: 104.04 },
                    { name: "金牛区站点", lat: 30.725, lng: 104.028 },
                    { name: "金牛区站点 (备用)", lat: 30.695, lng: 104.06 },
                    { name: "武侯区站点", lat: 30.63, lng: 104.05 },
                    { name: "武侯区站点 (备用)", lat: 30.605, lng: 103.98 }
                ];

                stations.forEach(station => {
                    // Generate random drone count (0-10)
                    const droneCount = Math.floor(Math.random() * 11);
                    
                    L.circleMarker([station.lat, station.lng], {
                        radius: 6,
                        fillColor: "#3b82f6",
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(this.map).bindPopup(`
                        <div class="text-center">
                            <div class="font-bold text-gray-800">${station.name}</div>
                            <div class="text-sm mt-1">
                                <i class="fa-solid fa-plane-up text-blue-500"></i>
                                无人机数量: <span class="font-bold text-blue-600">${droneCount}</span> 架
                            </div>
                        </div>
                    `);
                });

                // Add Alerts (Red)
                this.adminData.alerts.forEach(alert => {
                    const icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: "<div class='pulse-ring' style='border-color: #ef4444;'></div><div style='background-color:#ef4444; width:12px; height:12px; border-radius:50%; border:2px solid white;'></div>",
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    L.marker([alert.lat, alert.lng], { icon: icon }).addTo(this.map)
                        .bindPopup(`<b>${alert.location}</b><br>${alert.description}`);
                });

                this.loadAEDData();
            }, 50);
        },

        loadAEDData() {
            // Inline AED data to support file:// protocol
            const aedData = [
                {
                    "name": "四川省急救中心",
                    "address": "四川省人民医院东3门南60米",
                    "lng": 104.040325,
                    "lat": 30.662236
                },
                {
                    "name": "成都市第一人民医院南区急救中心",
                    "address": "万象北路18号成都市中西医结合医院",
                    "lng": 104.051208,
                    "lat": 30.590505
                },
                {
                    "name": "成都市急救指挥中心",
                    "address": "洪安镇黄平中路2号",
                    "lng": 104.272269,
                    "lat": 30.654426
                },
                {
                    "name": "四川省人民医院青羊院区急救中心",
                    "address": "一环路西二段32号(青羊宫地铁站D口步行270米)",
                    "lng": 104.040272,
                    "lat": 30.662354
                },
                {
                    "name": "四川省康复医院急救中心",
                    "address": "永宁街道八一路81号成都国际医学城内",
                    "lng": 103.898434,
                    "lat": 30.717483
                },
                {
                    "name": "应急救援装备",
                    "address": "金府五金机电城43栋10号",
                    "lng": 104.041875,
                    "lat": 30.717725
                },
                {
                    "name": "四川省第二中医医院急救中心",
                    "address": "四川省第二中医医院",
                    "lng": 104.054036,
                    "lat": 30.671765
                },
                {
                    "name": "成都市第六人民医院东虹院区急救",
                    "address": "东虹路39号成都市第六人民医院东虹院区",
                    "lng": 104.151315,
                    "lat": 30.639812
                },
                {
                    "name": "铂程非急救转运",
                    "address": "中环路青羊大道段7号附27号",
                    "lng": 104.007614,
                    "lat": 30.65722
                },
                {
                    "name": "成都市妇女儿童中心医院中心院区急救",
                    "address": "日月大道一段1617号成都市妇女儿童中心医院中心院区",
                    "lng": 103.960813,
                    "lat": 30.676286
                },
                {
                    "name": "彭州市急救中心(金彭西路)",
                    "address": "天彭街道金彭西路178号彭州市人民医院",
                    "lng": 103.937612,
                    "lat": 30.988488
                },
                {
                    "name": "简阳市急救指挥分中心",
                    "address": "简城镇医院路",
                    "lng": 104.547249,
                    "lat": 30.388299
                },
                {
                    "name": "成都天府国际机场急救中心",
                    "address": "骏业大道成都天府国际机场",
                    "lng": 104.450249,
                    "lat": 30.327379
                },
                {
                    "name": "金堂县急救指挥中心",
                    "address": "万方街与万吉巷交叉口南40米",
                    "lng": 104.422307,
                    "lat": 30.855069
                },
                {
                    "name": "蜀都客车急救中心",
                    "address": "运力大道与金韵路交叉口东南40米",
                    "lng": 104.150519,
                    "lat": 30.832281
                },
                {
                    "name": "四川省红十字会",
                    "address": "玉双路3号8栋(玉双路地铁站E1口步行350米)",
                    "lng": 104.09652,
                    "lat": 30.655416
                },
                {
                    "name": "成都市双流区红十字会",
                    "address": "花月东街62号",
                    "lng": 103.919348,
                    "lat": 30.577658
                },
                {
                    "name": "崇州市红十字会",
                    "address": "蜀州南路1号",
                    "lng": 103.669601,
                    "lat": 30.621064
                },
                {
                    "name": "郫都区红十字会",
                    "address": "郫筒镇望丛中路998号",
                    "lng": 103.902348,
                    "lat": 30.795868
                },
                {
                    "name": "四川红十字应急救援救护中心",
                    "address": "沙河街道川师成教院菱窠路90号教学楼4楼",
                    "lng": 104.119711,
                    "lat": 30.617729
                }
            ];

            aedData.forEach(aed => {
                // Green marker for AEDs
                const aedIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: '<div style="background-color:#10b981; width:10px; height:10px; border-radius:50%; border:2px solid white; box-shadow: 0 0 5px rgba(16, 185, 129, 0.4);"></div>',
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                });
                
                L.marker([aed.lat, aed.lng], { icon: aedIcon })
                    .addTo(this.map)
                    .bindPopup(`
                        <div class="text-center min-w-[150px]">
                            <div class="font-bold text-gray-800 text-sm mb-1"><i class="fa-solid fa-heart-pulse text-green-500 mr-1"></i>AED 设备点</div>
                            <div class="font-bold text-green-700 mb-1">${aed.name}</div>
                            <div class="text-xs text-gray-500 text-left border-t pt-1 mt-1">${aed.address || '地址暂无'}</div>
                        </div>
                    `);
            });
            
            // Update stats
            this.adminData.stats.aedsTotal = aedData.length;
            this.adminData.stats.aedsAvailable = Math.floor(aedData.length * 0.95);
        },

        focusAlert(alert) {
            this.map.flyTo([alert.lat, alert.lng], 16);
        },

        async getRoute(start, end) {
            // Check if Mapbox token is provided (placeholder)
            const mapboxToken = ''; // User can fill this
            
            // Default to OSRM (Open Source Routing Machine) - Free, No Key
            // Coordinates format: lon,lat
            const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    // Extract coordinates (lon,lat) and convert to (lat,lon)
                    return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                }
            } catch (error) {
                console.error("Routing failed:", error);
            }
            
            // Fallback to straight line
            return [start, end];
        },

        async dispatchDrone(alert) {
            // 1. Find nearest station (simplified for demo: Qingyang station)
            const station = { lat: 30.678, lng: 103.962, name: '青羊区站点' }; 
            
            // 2. Find nearest AED (simplified for demo: using a fixed nearby AED)
            const aedLocation = { lat: 30.670, lng: 104.000, name: '附近AED点' };

            // 3. Get Real Routes
            const route1 = await this.getRoute([station.lat, station.lng], [aedLocation.lat, aedLocation.lng]);
            const route2 = await this.getRoute([aedLocation.lat, aedLocation.lng], [alert.lat, alert.lng]);

            // Construct segments for animation
            // We combine the routes into a sequence of small segments
            const pathSegments = [];
            
            // Helper to add segments from points
            const addSegments = (points, color, label, type) => {
                for (let i = 0; i < points.length - 1; i++) {
                    pathSegments.push({
                        start: points[i],
                        end: points[i+1],
                        color: color,
                        label: label,
                        type: type // 'pickup' or 'deliver'
                    });
                }
            };

            addSegments(route1, '#3b82f6', '取货', 'pickup');
            addSegments(route2, '#10b981', '配送', 'deliver');

            // Draw paths (draw the full polylines, not just segments, for performance/look)
            L.polyline(route1, { color: '#3b82f6', weight: 4, opacity: 0.7 }).addTo(this.map);
            L.polyline(route2, { color: '#10b981', weight: 4, opacity: 0.7, dashArray: '5, 10' }).addTo(this.map);

            // Add active drone icon
            const droneIcon = L.divIcon({
                html: '<i class="fa-solid fa-plane text-blue-500 text-xl" style="filter: drop-shadow(0 0 2px white);"></i>',
                className: 'drone-moving',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            const drone = L.marker([station.lat, station.lng], { icon: droneIcon, zIndexOffset: 1000 }).addTo(this.map);
            
            // Task Data
            const taskId = Date.now();
            const task = {
                id: taskId,
                droneId: 'DR-' + Math.floor(Math.random() * 90 + 10),
                status: '前往取AED',
                eta: 8,
                distance: 5.5,
                progress: 0
            };
            this.adminData.activeTasks.unshift(task);

            // Animation Logic
            let segmentIndex = 0;
            let progress = 0;
            // Speed needs to be much higher because segments are tiny
            // Ideally speed should be based on distance, but simple boost works for demo
            const speed = 0.25; 

            const animate = () => {
                if (segmentIndex >= pathSegments.length) {
                    drone.bindPopup("<b>救援完成</b><br>AED已送达事故点").openPopup();
                    task.status = '已送达';
                    task.eta = 0;
                    return;
                }

                const segment = pathSegments[segmentIndex];
                progress += speed;

                if (progress >= 1) {
                    progress = 0;
                    segmentIndex++;
                    
                    // Check for state change based on segment type transition
                    if (segmentIndex < pathSegments.length) {
                        const nextSegment = pathSegments[segmentIndex];
                        if (segment.type === 'pickup' && nextSegment.type === 'deliver') {
                            // Picked up AED
                            task.status = '配送AED中';
                            droneIcon.options.html = '<i class="fa-solid fa-plane text-green-600 text-xl" style="filter: drop-shadow(0 0 2px white);"></i><i class="fa-solid fa-heart-pulse text-red-500 text-xs absolute -bottom-1 -right-1 bg-white rounded-full p-0.5"></i>';
                            drone.setIcon(droneIcon);
                            drone.bindPopup("<b>已获取AED</b><br>飞往事故点...").openPopup();
                            setTimeout(() => drone.closePopup(), 2000);
                        }
                    }
                } else {
                    // Interpolate position
                    const lat = segment.start[0] + (segment.end[0] - segment.start[0]) * progress;
                    const lng = segment.start[1] + (segment.end[1] - segment.start[1]) * progress;
                    drone.setLatLng([lat, lng]);
                    
                    // Update task info
                    if (Math.random() > 0.9) { 
                        const totalSegments = pathSegments.length;
                        const remaining = 1 - (segmentIndex / totalSegments);
                        task.eta = Math.max(0, (8 * remaining).toFixed(1));
                    }
                }

                requestAnimationFrame(animate);
            };

            // Start animation
            requestAnimationFrame(animate);
        }
    }
}).mount('#app');
