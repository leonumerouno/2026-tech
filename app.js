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
            this.userState.eta = 12;
            this.userState.isRecycled = false;

            if (this.userState.simulationInterval) clearInterval(this.userState.simulationInterval);

            // Simulation Loop
            this.userState.simulationInterval = setInterval(() => {
                if (this.userState.eta > 0) {
                    this.userState.eta--;
                    
                    // Simulate drone movement (interpolate)
                    if (this.map && this.droneMarker) {
                        const currentLatLng = this.droneMarker.getLatLng();
                        const targetLatLng = L.latLng(30.6570, 104.0665); // User loc in Chengdu
                        
                        const lat = currentLatLng.lat + (targetLatLng.lat - currentLatLng.lat) * 0.1;
                        const lng = currentLatLng.lng + (targetLatLng.lng - currentLatLng.lng) * 0.1;
                        
                        this.droneMarker.setLatLng([lat, lng]);
                    }

                    // Update steps based on ETA
                    if (this.userState.eta <= 10 && this.userState.step === 0) {
                        this.userState.step = 1; // Picked up
                    }
                    if (this.userState.eta <= 8 && this.userState.step === 1) {
                        this.userState.step = 2; // Delivering
                    }
                } else {
                    this.userState.step = 3; // Arrived
                    clearInterval(this.userState.simulationInterval);
                }
            }, 1000); // Fast simulation: 1 sec = 1 min
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
                this.userState.isRecycled = true;
                alert('感谢您的使用！无人机将自动回收设备。');
                // Simulate return flight could go here
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
            fetch('./aed_data.json')
                .then(response => response.json())
                .then(data => {
                    data.forEach(aed => {
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
                    this.adminData.stats.aedsTotal = data.length;
                    this.adminData.stats.aedsAvailable = Math.floor(data.length * 0.95);
                })
                .catch(err => console.error('Failed to load AED data:', err));
        },

        focusAlert(alert) {
            this.map.flyTo([alert.lat, alert.lng], 16);
        },

        dispatchDrone(alert) {
            // 1. Find nearest station (simplified for demo: Qingyang station)
            const station = { lat: 30.678, lng: 103.962, name: '青羊区站点' }; 
            
            // 2. Find nearest AED (simplified for demo: using a fixed nearby AED)
            // Ideally we would search through loaded AEDs, but for now we'll pick one "en route" or nearby
            const aedLocation = { lat: 30.670, lng: 104.000, name: '附近AED点' };

            // 3. Define path: Station -> AED -> Incident
            const pathSegments = [
                { start: [station.lat, station.lng], end: [aedLocation.lat, aedLocation.lng], color: '#3b82f6', label: '取货' }, // Blue: To AED
                { start: [aedLocation.lat, aedLocation.lng], end: [alert.lat, alert.lng], color: '#10b981', label: '配送' }      // Green: To Incident
            ];

            // Draw paths
            pathSegments.forEach(seg => {
                L.polyline([seg.start, seg.end], { 
                    color: seg.color, 
                    weight: 3, 
                    dashArray: '5, 10',
                    opacity: 0.7 
                }).addTo(this.map);
            });

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
            const speed = 0.015; // Animation speed

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
                    // Segment complete
                    progress = 0;
                    segmentIndex++;
                    
                    if (segmentIndex === 1) {
                        // Picked up AED
                        task.status = '配送AED中';
                        droneIcon.options.html = '<i class="fa-solid fa-plane text-green-600 text-xl" style="filter: drop-shadow(0 0 2px white);"></i><i class="fa-solid fa-heart-pulse text-red-500 text-xs absolute -bottom-1 -right-1 bg-white rounded-full p-0.5"></i>';
                        drone.setIcon(droneIcon);
                        drone.bindPopup("<b>已获取AED</b><br>飞往事故点...").openPopup();
                        setTimeout(() => drone.closePopup(), 2000);
                    }
                } else {
                    // Interpolate position
                    const lat = segment.start[0] + (segment.end[0] - segment.start[0]) * progress;
                    const lng = segment.start[1] + (segment.end[1] - segment.start[1]) * progress;
                    drone.setLatLng([lat, lng]);
                    
                    // Update task info
                    if (Math.random() > 0.9) { // Don't update DOM too often
                        task.eta = Math.max(0, (8 * (1 - (segmentIndex * 0.5 + progress * 0.5))).toFixed(1));
                    }
                }

                requestAnimationFrame(animate);
            };

            // Start animation
            requestAnimationFrame(animate);
        }
    }
}).mount('#app');
