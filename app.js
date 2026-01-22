import { createApp, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

createApp({
    data() {
        return {
            currentView: 'home', // 'home', 'user', 'admin'
            currentTime: '',
            
            // User Platform State
            userState: {
                step: 0, // 0: Fetching, 1: Delivering, 2: Delivered/Arrived
                eta: 12,
                isRecycled: false,
                simulationInterval: null
            },

            // Admin Platform Data
            adminData: {
                stats: {
                    dronesTotal: 48,
                    dronesAvailable: 36,
                    aedsTotal: 120,
                    aedsAvailable: 105
                },
                alerts: [
                    { id: 1, location: '天府广场东侧', description: '心脏骤停疑似，需AED支持', lat: 30.6580, lng: 104.0670 },
                    { id: 2, location: '宽窄巷子入口', description: '游客昏倒，呼吸微弱', lat: 30.6630, lng: 104.0550 }
                ],
                activeTasks: [
                    { id: 101, droneId: 'DR-08', status: '配送中', eta: 4, distance: 2.1, from: [30.65, 104.06], to: [30.66, 104.07] }
                ]
            },
            
            map: null, // Leaflet map instance
            markers: [],
            polylines: []
        };
    },
    mounted() {
        this.updateTime();
        setInterval(this.updateTime, 1000);
    },
    methods: {
        updateTime() {
            const now = new Date();
            this.currentTime = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        },
        
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

            // Chengdu Coordinates (User at Tianfu Square area)
            const userLoc = [30.6570, 104.0665];
            const droneStart = [30.6700, 104.0750]; // Nearby station

            this.map = L.map('user-map').setView(userLoc, 14);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(this.map);

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

            // Center on Chengdu
            const center = [30.6570, 104.0665];
            this.map = L.map('admin-map').setView(center, 11); // Zoom out a bit to see more districts

            // Dark theme map
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(this.map);

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
                { name: "武侯区站点", lat: 30.625, lng: 104.0 },
                { name: "高新区站点", lat: 30.52, lng: 104.075 },
                { name: "锦江区站点", lat: 30.592, lng: 104.132 },
                { name: "成华区站点", lat: 30.722, lng: 104.152 },
                { name: "金牛区站点", lat: 30.758, lng: 104.045 }
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
        },

        focusAlert(alert) {
            this.map.flyTo([alert.lat, alert.lng], 16);
        },

        dispatchDrone(alert) {
            // Find nearest station (using first one for demo)
            const station = [30.678, 103.962]; // Qingyang station
            
            // Add route line
            const route = [station, [alert.lat, alert.lng]];
            const polyline = L.polyline(route, { color: '#10b981', weight: 3, dashArray: '5, 10' }).addTo(this.map);
            
            // Add active drone icon
            const droneIcon = L.divIcon({
                html: '<i class="fa-solid fa-plane text-green-500 text-lg"></i>',
                className: 'drone-moving',
                iconSize: [20, 20]
            });
            const drone = L.marker(station, { icon: droneIcon }).addTo(this.map);

            // Add to active tasks list
            this.adminData.activeTasks.unshift({
                id: Date.now(),
                droneId: 'DR-' + Math.floor(Math.random() * 90 + 10),
                status: '出勤中',
                eta: 5,
                distance: 3.2
            });

            // Simple animation
            let step = 0;
            const steps = 100;
            const interval = setInterval(() => {
                step++;
                const lat = station[0] + (alert.lat - station[0]) * (step / steps);
                const lng = station[1] + (alert.lng - station[1]) * (step / steps);
                drone.setLatLng([lat, lng]);

                if (step >= steps) {
                    clearInterval(interval);
                    drone.bindPopup("已到达").openPopup();
                }
            }, 50);
        }
    }
}).mount('#app');
