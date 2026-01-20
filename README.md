# 无人机救助调度平台 (Drone Rescue Platform)

一个基于 Web 的智能无人机 AED 急救调度系统演示原型。包含用户呼救端和 120 指挥中心管理端。

## 功能特点

### 1. 呼救者/用户端
- **实时状态追踪**: 监控无人机取货、配送、送达的全过程。
- **地图可视化**: 动态展示无人机飞行路线和实时位置模拟。
- **预计到达时间 (ETA)**: 实时倒计时显示。
- **设备回收**: 任务完成后提供设备归还交互。

### 2. 120 指挥中心 (管理端)
- **全局监控**: 可视化展示所有站点、AED 资源和无人机状态。
- **智能调度**: 接收紧急报警并一键调度无人机。
- **数据看板**: 实时统计无人机和 AED 的可用数量。

## 技术栈
- **核心**: HTML5, JavaScript (ES6+), CSS3
- **框架**: Vue.js 3 (ESM 模块化)
- **UI 库**: Tailwind CSS
- **地图**: Leaflet.js + OpenStreetMap/CartoDB

## 快速开始

1. 克隆仓库:
   ```bash
   git clone https://github.com/your-username/drone-rescue.git
   ```
2. 进入目录:
   ```bash
   cd drone-rescue
   ```
3. 启动本地服务器 (需要 Python):
   ```bash
   python -m http.server 8000
   ```
   或者使用其他静态文件服务器 (如 Live Server, http-server 等)。

4. 访问 `http://localhost:8000`

## 目录结构
- `index.html`: 主页面结构和样式
- `app.js`: Vue 应用逻辑、地图初始化和状态管理
