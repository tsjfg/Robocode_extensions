# Robocode_extensions

> 关于 Robocode 一些好用的拓展 —— 面向 `E6` / `E7` / `M6` 设备的积木扩展包集合。

本仓库收集并维护可用于 Robocode 编程平台的第三方（非官方）拓展。每个拓展以独立目录存放，通过 `config.json` 声明元信息、`index.js` 定义积木逻辑，配合图标与资源文件即可被平台加载。所有拓展均生成 **Python** 代码，支持设备：`E6`、`E7`、`M6`。

## 🔌 拓展列表

| 拓展 | 目录 | 说明 | 详细文档 |
| --- | --- | --- | --- |
| **数据测试** | `robocode拓展/test/` | 调试用拓展：舵机角度 / 马达编码值实时显示到屏幕，并提供 8 格触屏任务面板 | [README](./robocode%E6%8B%93%E5%B1%95/test/README.md) |
| **舵机狗** | `robocode拓展/舵机狗2/` | 四足舵机狗控制拓展：前进 / 后退 / 转向 / 站立 / 坐下 / 趴下 / 狗叫 / 抬腿 / 自定义姿势等 | [README](./robocode%E6%8B%93%E5%B1%95/%E8%88%B5%E6%9C%BA%E7%8B%972/README.md) |
| **PID巡线** | `robocode拓展/PID巡线/` | PID 巡线底层：4 光电 / 循迹卡双模式加权 PID，支持巡线、路口识别、直走与转编码值 | [README](./robocode%E6%8B%93%E5%B1%95/PID%E5%B7%A1%E7%BA%BF/README.md) |

> 各拓展的完整说明（硬件接线、算法原理、参数速查、踩坑清单）见对应目录下的 `README.md`。

---

## 📦 数据测试（`test/`）

调试辅助类拓展，主要用于验证舵机与马达数据是否正确，并提供便捷的触屏任务面板。

### 积木清单

| 积木 | 说明 |
| --- | --- |
| `释放所有舵机` | 将 1～8 号舵机全部释放（置为 0 转矩） |
| `显示舵机角度 [端口]` | 将所选端口（P1～P8 / 全部）的舵机角度以 2×4 布局实时显示到屏幕 |
| `任务面板 [方向]` | 在屏幕上绘制 8 格任务区，点击任务格即单独执行对应子堆栈，任务8可依次执行任务1~7 |
| `显示马达编码值` | 持续显示 M1～M4 马达编码值并计算 M1、M2 平均值；按左键可重新清零编码值 |

### 所用模块

- `servo` —— 磁性舵机角度读取与控制（`GetMagneticServoDegree` / `SetMagneticServoMotor`）
- `motor` —— 马达编码值读取（`GetMotorCode` / `SetMotorCode`）
- `rcu` —— 屏幕文本显示（`SetDisplayStringXY`）、触屏（`GetTouchScreen`）、延时（`SetWaitForTime`）

---

## 🐕 舵机狗（`舵机狗2/`）

基于四路磁性舵机的仿生小狗控制拓展。四路舵机分别对应 **左手 / 右手 / 左脚 / 右脚**，通过预设步态序列实现行走、转向与各种姿态动作。

### 积木清单

| 积木 | 说明 |
| --- | --- |
| `初始化` | 将四条腿复位到站立姿态 `[0,0,0,0]`，默认速度 80、节拍 0.15s |
| `前进 [steps] 次` | 按步态序列前进 |
| `后退 [steps] 次` | 按反向步态序列后退 |
| `左转 [steps] 次` | 原地左转（每次内部循环 6 拍） |
| `右转 [steps] 次` | 原地右转（每次内部循环 6 拍） |
| `站立` | 四条腿复位站立 |
| `坐下` | 呈现坐姿（后腿抬升） |
| `趴下` | 四腿全部压低 |
| `狗叫 [叫声类型]` | 播放叫声音频（叫声1 / 叫声2） |
| `执行动作 [动作]` | 前顶、后顶、左挥手、右挥手、摇摆 |
| `[左/右/前后腿] 抬起 [angle] 度` | 单独控制某条腿抬起到指定角度 |
| `将姿势设为左手[LF] 右手[RF] 左脚[LB] 右脚[RB]` | 直接指定四腿角度自定义姿势 |
| `释放所有舵机` | 将 1～4 号舵机全部释放 |
| `显示当前角度` | 将四路舵机当前角度显示到屏幕 |
| `将速度设为[speed]，节拍设为[time]秒` | 修改全局速度与步态节拍参数 |

### 资源文件

- `worf/xm4077.mp3`、`worf/xm4081.mp3` —— 供“狗叫”积木播放的音频
- `img/blockIcon/DOG.svg`、`img/menuIcon/DOG.svg` —— 积木图标
- `OMEOGiWRIHpRTBrbIlzv.png` —— 拓展封面图

### 所用模块

- `servo` —— 磁性舵机角度 / 速度控制
- `rcu` —— 延时（`SetWaitForTime`）、屏幕显示、音频播放
- `time` —— 辅助计时

---

## 🧭 PID巡线（`PID巡线/`）

PID 巡线底层拓展，支持 **4 光电**（差值法）与 **循迹卡**（重心法）双模式，运行时根据电机类型（白红 / 灰红）与阵列类型自动选用对应 PID 参数组。只要用到任一积木，底层函数就会整体注入到生成的 Python 程序中（字典去重，不会重复注入）。

### 传感器安装

车头朝前，从车的左侧到右侧依次编号：

- **4 光电**（`E007 = 4`）：插在 `P1 P2 P3 P4`
  - 巡线采用**差值法**：`误差 = 光值(P3) - 光值(P2)`，直接用原始模拟光值；
  - 压线判定：`sensor.GetLightSensorData(i) == var_xun_xian_yan_se`
- **循迹卡**（`E007 = 7`）：插在 `P1` 端口，通道 1~7
  - 巡线采用**重心法**：权重 `[-3,-2,-1,0,+1,+2,+3]`，误差归一化到 ±100；
  - 压线判定：`trace.GetTraceV2I2CState(P1端口, i) == var_xun_xian_yan_se`

### PID 参数

`Kp / Ki / Kd` 写死在底层参数表中，运行时按 `E005`（电机类型）× `E007`（阵列类型）自动装载四组之一：

| 下标 | 组合 | Kp | Ki | Kd |
| --- | --- | --- | --- | --- |
| [0] | 白红 + 4 光电 | 0.015 | 0.000 | 0.030 |
| [1] | 白红 + 循迹卡 | 0.80 | 0.00 | 1.60 |
| [2] | 灰红 + 4 光电 | 0.010 | 0.000 | 0.030 |
| [3] | 灰红 + 循迹卡 | 0.40 | 0.00 | 1.60 |

### 积木清单

| 积木 | 说明 |
| --- | --- |
| `初始化 巡线颜色 [颜色]` | 选择黑线 / 白线，装载对应 PID 参数 |
| `巡线遇路口停 速度 [speed] 路口类型 [jtype] 调整编码值 [adjust]` | 巡线直到遇到指定路口（左 / 右 / T，可带“+冲出”）停车 |
| `巡线距离 速度 [speed] 编码值 [bmp]` | 按编码值巡线指定距离 |
| `[左/右] 转到线` | 原地转到压线位置 |
| `走距离 速度 [sp] 编码值 [bmp]` | 不带巡线直接按编码值直走 |
| `转编码值 左轮速度 [spl] 右轮速度 [spr] 编码值 [bmp]` | 按指定左右轮速度转到目标编码值 |

### 资源文件

- `PIDXunXian0001E6E7M6.png` —— 拓展封面图
- `生成的代码示例.py` —— 生成代码示例
- `img/blockIcon/PID.svg`、`img/menuIcon/PID.svg` —— 积木图标

### 所用模块

- `rcu` —— 参数读取（`GetData`）、延时
- `math` —— 数值计算
- `motor` —— 马达控制
- `sensor` —— 光电传感器读取
- `trace` —— 循迹卡读取

---

## 📁 项目结构

```
Robocode_extensions/
├── README.md                  # 本文档
├── LICENSE                    # MIT 许可证
└── robocode拓展/               # 拓展所在的根目录
    ├── test/                  # 拓展一：数据测试
    │   ├── README.md          #   拓展详细文档
    │   ├── config.json        #   拓展元信息（平台读取）
    │   ├── index.js           #   积木逻辑定义
    │   ├── test.png           #   封面图
    │   └── img/
    │       ├── blockIcon/     #   积木图标（SVG）
    │       └── menuIcon/      #   菜单图标（SVG）
    ├── 舵机狗2/                # 拓展二：舵机狗
    │   ├── README.md
    │   ├── config.json
    │   ├── index.js
    │   ├── OMEOGiWRIHpRTBrbIlzv.png
    │   ├── img/
    │   │   ├── blockIcon/DOG.svg
    │   │   └── menuIcon/DOG.svg
    │   └── worf/              # 狗叫音频资源
    │       ├── xm4077.mp3
    │       └── xm4081.mp3
    └── PID巡线/                # 拓展三：PID巡线
        ├── README.md
        ├── config.json
        ├── index.js
        ├── PIDXunXian0001E6E7M6.png
        ├── 生成的代码示例.py
        └── img/
            ├── blockIcon/PID.svg
            └── menuIcon/PID.svg
```

---

## 🚀 安装与使用

1. 将 `robocode拓展/` 目录整体放入 Robocode 平台的拓展加载目录中；
2. 在平台的项目中刷新 / 重新加载拓展列表；
3. 即可在积木面板中找到 **数据测试**、**舵机狗**、**PID巡线** 三组积木，拖拽并生成 Python 代码后上传至 `E6` / `E7` / `M6` 设备运行。

> 具体加载路径与刷新方式请参考你所使用的 Robocode 平台文档。

---

## 🛠 开发指南

每个拓展目录的标准结构如下：

```
扩展名/
├── config.json        # 拓展元信息
├── index.js           # 积木逻辑（window.Scratch 扩展）
├── <cover>.png        # 封面图（可选）
├── img/
│   ├── blockIcon/     # 积木图标 SVG
│   └── menuIcon/      # 菜单图标 SVG
└── ...                # 其他资源（音频、图片等）
```

### config.json 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 拓展唯一 ID，需与 `index.js` 中的类 ID 对应 |
| `name` | string | 拓展显示名称 |
| `description` | string | 拓展描述 |
| `icon` | string | 图标路径（可留空） |
| `cover` | string | 封面图片文件名 |
| `codeTypes` | string[] | 生成的代码类型，如 `["Python"]` |
| `order` | string | 排序权重 |
| `supportDevice` | string[] | 支持的设备型号 |
| `official` | bool | 是否为官方拓展（本仓库均为 `false`） |

### index.js 要点

- 必须从 `window.Scratch` 解构出所需 API（如 `ArgumentType`、`BlockType`、`ScratchBlocks` 等）；
- 导出一个以拓展 ID 命名的 `xxxBlock` 类；
- `_generateCode()` 定义各积木生成的 Python 代码，并可用 `ScratchBlocks.Python.Import(...)` 声明所需模块；
- 需要注入底层函数时，通过 `ScratchBlocks.Python.functionNames_[名字] = "def ..."` 注册（字典去重，重复注入只保留一份）；
- 用 `ScratchBlocks.Python.valueToCode(block, "参数", 16)` 取数值输入，用 `block.getFieldValue("下拉名")` 取下拉菜单；
- `getInfo()` 返回积木面板的定义（`blocks`、`menus`、颜色、图标、支持设备等）。

### 图标规范

- `img/blockIcon/` 与 `img/menuIcon/` 下存放 **SVG** 格式图标，需与 `index.js` 中 `this.imgs.blockIcon[...]` / `this.imgs.menuIcon[...]` 引用的文件名对应。

---

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE) 发布。
