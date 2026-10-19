const { ArgumentType, BlockType, ScratchBlocks, formatMessage, send } =
    window.Scratch;

class TeStQmZxNvRbLhJdWkCpBlock {
    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    static _generateCode() {
        /**
         * 面板生成期状态。
         * > 0 表示当前正在生成「任务面板」里某个任务的积木体。
         * 此时显示类积木（显示舵机角度 / 显示马达编码值）会改成生成
         * 「每帧刷新」形式的函数并注册给面板，而不是自己开一个 while True，
         * 否则任务永远不会返回，面板的触摸轮询会被卡死，而且两边画面互相覆盖。
         */
        let panelDepth = 0;
        const inPanel = () => panelDepth > 0;

        /**
         * 场地学习底层。流程和用词对齐「设置程序」里的场地学习：
         *   扫描场地 -> 结果检测 -> 光电健康参考指数
         *
         * 手动跑一次，学完给一个 0~100 的健康指数：
         *   指数 >= _SITE_PASS_SCORE(60) -> 阈值写进控制器，显示「设置成功」+ 两声提示音
         *   指数 <  60                  -> 不写阈值，显示「请重新学习」+ 三声提示音
         * 阈值由控制器自己保存，重跑程序仍然有效，所以确认成功后把积木删掉即可。
         *
         * 4 光电（默认 P1~P4）：
         *   反复采样 sensor.GetLightSensor(p)（0~4095，越白数值越大），
         *   记录每一路的最大值（白）和最小值（黑），
         *   健康指数 = 四路里最小的（白 - 黑） * 100 / _SITE_FULL_SPAN，上限 100。
         *   成功时阈值 = (白 + 黑) / 2，写回 sensor.SetLightSensorThreshold(p, 阈值)。
         *   之后 sensor.GetLightSensorData(p) 就能直接用：
         *       1 = 光值低于阈值（压黑线）   0 = 高于阈值（白）
         *
         * 循迹卡（BE-1149，默认插 P1）：
         *   直接调用卡片自带的自动扫描 trace.SetTraceV2I2Threshold(端口, 秒)，
         *   它内部会阻塞 秒*100*10ms 真扫一遍；扫完再采 1 秒相对值算指数，
         *   阈值用命令 11~17 读回显示。
         */
        const SITE_CORE = `
# ============================================================
#  场地学习  —— 由「数据测试」扩展自动生成
#
#  流程和用词对齐「设置程序」里的场地学习：
#      扫描场地  ->  结果检测  ->  光电健康参考指数
#
#  手动跑一次就行：学完给一个 0~100 的健康指数，
#      指数 >= _SITE_PASS_SCORE  -> 阈值写入控制器，显示「设置成功」+ 两声提示音
#      指数 <  _SITE_PASS_SCORE  -> 不写阈值，显示「请重新学习」+ 三声提示音
#  确认「设置成功」之后，这个积木就可以从程序里删掉了
#  （阈值存在控制器里，重跑程序仍然有效，不需要每次重学）。
#
#  4 光电（默认 P1~P4）：
#      在黑白线之间来回移动，程序记录每一路的最大值（白）与最小值（黑），
#      黑白差越大说明对比越明显。指数取四路里最差那一路：
#          健康指数 = 最小黑白差 * 100 / _SITE_FULL_SPAN   （上限 100）
#      成功时阈值 = (白 + 黑) / 2，写回控制器：
#          sensor.SetLightSensorThreshold(端口, 阈值)
#      之后 sensor.GetLightSensorData(端口) 可以直接用：
#          1 = 光值低于阈值（压黑线）     0 = 高于阈值（白）
#  循迹卡（BE-1149，默认插在 P1）：
#      用卡片自带的自动扫描：trace.SetTraceV2I2Threshold(端口, 秒数)
#      扫完再采 1 秒相对值算黑白差，指数算法同上（满分量程 _SITE_FULL_TRACE）
#      阈值用命令 11~17 读回显示
# ============================================================

_SITE_FULL_SPAN = 2000      # 4 光电：黑白差达到这个值就是满分
_SITE_FULL_TRACE = 150      # 循迹卡：相对值差达到这个值就是满分
_SITE_PASS_SCORE = 60       # 健康指数 >= 这个值算「设置成功」，否则提示重新学习
_SITE_TRACE_PORT = 1        # 循迹卡插在哪个端口（P1~P8）
_SITE_SCORE = 0             # 最近一次的评分


def _site_pad(s, n):
    # 这块屏不会自动擦掉旧字符：字符串变短时必须补空格，否则会残留上一次的数字
    s = str(s)
    while len(s) < n:
        s = s + " "
    return s


def _site_mode(mode):
    # mode: 0 = 自动（读 E007），4 = 强制 4 光电，7 = 强制循迹卡
    if mode == 0:
        mode = rcu.GetData(7)
    if mode == 7:
        return 7
    return 4


def _site_score(span, full):
    # 黑白差换算成 0~100 的评分，越大说明黑白对比越明显
    s = span * 100 // full
    if s > 100:
        s = 100
    if s < 0:
        s = 0
    return s


def _site_min_span(lo, hi):
    # 取所有通道里最小的黑白差：只要有一路看不清，整组就不可靠
    m = hi[0] - lo[0]
    for i in range(1, len(lo)):
        if hi[i] - lo[i] < m:
            m = hi[i] - lo[i]
    return m


def _site_beep(n):
    # 提示音：成功两声、失败三声（跟设置程序的「do re mi」/「滴滴滴」是一个意思）
    for i in range(n):
        rcu.SetInBeep(1)
        rcu.SetWaitForTime(0.08)
        rcu.SetInBeep(0)
        rcu.SetWaitForTime(0.12)


def _site_verdict(score):
    # 健康指数那一行（绿 = 设置成功 / 红 = 请重新学习），返回 1 表示成功
    if score >= _SITE_PASS_SCORE:
        rcu.SetDisplayStringXY(0, 258, _site_pad("健康指数 " + str(score) + " 设置成功", 16), 0x07E0, 0x0000, 0)
        _site_beep(2)
        return 1
    rcu.SetDisplayStringXY(0, 258, _site_pad("健康指数 " + str(score) + " 请重新学习", 16), 0xF800, 0x0000, 0)
    _site_beep(3)
    return 0


def _site_learn_4(seconds):
    global _SITE_SCORE
    rcu.SetLCDClear(0x0000)
    rcu.SetDisplayStringXY(0, 290, "扫描场地 4 光电", 0x07FF, 0x0000, 0)
    rcu.SetDisplayStringXY(0, 40, "在黑白线之间来回移动", 0xFFE0, 0x0000, 0)
    lo = [4095, 4095, 4095, 4095]
    hi = [0, 0, 0, 0]
    n = int(seconds * 20)
    if n < 1:
        n = 1
    for k in range(n):
        for i in range(4):
            v = sensor.GetLightSensor(i + 1)
            if v < lo[i]:
                lo[i] = v
            if v > hi[i]:
                hi[i] = v
            rcu.SetDisplayStringXY(0, 250 - i * 30, _site_pad("P" + str(i + 1) + " " + str(v), 14), 0x07FF, 0x0000, 0)
        rcu.SetWaitForTime(0.05)
    span = _site_min_span(lo, hi)
    _SITE_SCORE = _site_score(span, _SITE_FULL_SPAN)
    rcu.SetLCDClear(0x0000)
    rcu.SetDisplayStringXY(0, 290, "结果检测", 0x07FF, 0x0000, 0)
    ok = _site_verdict(_SITE_SCORE)
    for i in range(4):
        thr = int((lo[i] + hi[i]) / 2)
        if ok == 1:
            # 只有评分合格才写阈值：宁可保持上一次的好参数，也不写进一组烂的
            sensor.SetLightSensorThreshold(i + 1, thr)
        c = 0x07FF
        if _site_score(hi[i] - lo[i], _SITE_FULL_SPAN) < _SITE_PASS_SCORE:
            c = 0xF800
        rcu.SetDisplayStringXY(0, 228 - i * 30, _site_pad("P" + str(i + 1) + " " + str(hi[i]) + "/" + str(lo[i]) + " " + str(thr), 18), c, 0x0000, 0)
    rcu.SetDisplayStringXY(0, 40, _site_pad("最小黑白差 " + str(span), 16), 0x8410, 0x0000, 0)


def _site_learn_trace(seconds):
    global _SITE_SCORE
    rcu.SetLCDClear(0x0000)
    rcu.SetDisplayStringXY(0, 290, "扫描场地 循迹卡", 0x07FF, 0x0000, 0)
    rcu.SetDisplayStringXY(0, 40, "在黑白线之间来回移动", 0xFFE0, 0x0000, 0)
    sec = int(seconds)
    if sec < 1:
        sec = 1
    trace.SetTraceV2I2Threshold(_SITE_TRACE_PORT, sec)
    # 卡片扫完再采 1 秒相对值，用黑白差算评分
    lo = [255, 255, 255, 255, 255, 255, 255]
    hi = [0, 0, 0, 0, 0, 0, 0]
    for k in range(20):
        for i in range(7):
            v = trace.GetTraceV2I2C(_SITE_TRACE_PORT, i + 1)
            if v < lo[i]:
                lo[i] = v
            if v > hi[i]:
                hi[i] = v
        rcu.SetWaitForTime(0.05)
    span = _site_min_span(lo, hi)
    _SITE_SCORE = _site_score(span, _SITE_FULL_TRACE)
    rcu.SetLCDClear(0x0000)
    rcu.SetDisplayStringXY(0, 290, "结果检测", 0x07FF, 0x0000, 0)
    _site_verdict(_SITE_SCORE)
    for i in range(7):
        thr = trace.GetTraceV2I2C(_SITE_TRACE_PORT, 11 + i)
        c = 0x07FF
        if _site_score(hi[i] - lo[i], _SITE_FULL_TRACE) < _SITE_PASS_SCORE:
            c = 0xF800
        rcu.SetDisplayStringXY(0, 228 - i * 26, _site_pad("CH" + str(i + 1) + " " + str(thr), 14), c, 0x0000, 0)
    rcu.SetDisplayStringXY(0, 40, _site_pad("最小黑白差 " + str(span), 16), 0x8410, 0x0000, 0)


def _site_hold():
    # 面板里跑的时候，结果要停在屏幕上等你看完（点屏幕 / 按左键继续，最多 30 秒）
    t = 0
    while t < 600:
        if rcu.GetTouchScreen():
            break
        if rcu.GetLeftButton():
            break
        rcu.SetWaitForTime(0.05)
        t = t + 1


def site_learn(mode, seconds, hold):
    if _site_mode(mode) == 7:
        _site_learn_trace(seconds)
    else:
        _site_learn_4(seconds)
    if hold == 1:
        rcu.SetDisplayStringXY(0, 10, "点屏幕继续", 0x8410, 0x0000, 0)
        _site_hold()
`;

        return {
            Python: {
                block_ZBtSNzlYrFppaVxQtmWO: function (block) {
                    ScratchBlocks.Python.Import("servo");

                    ScratchBlocks.Python.functionNames_["释放所有舵机"] = `
def release_servos():
    servo.SetMagneticServoMotor(1, 0)
    servo.SetMagneticServoMotor(2, 0)
    servo.SetMagneticServoMotor(3, 0)
    servo.SetMagneticServoMotor(4, 0)
    servo.SetMagneticServoMotor(5, 0)
    servo.SetMagneticServoMotor(6, 0)
    servo.SetMagneticServoMotor(7, 0)
    servo.SetMagneticServoMotor(8, 0)
`;

                    return `release_servos()\r\n`;
                },
                block_vFKdnEQUZCVetfTBMaFH: function (block) {
                    ScratchBlocks.Python.Import("servo");
                    ScratchBlocks.Python.Import("rcu");

                    const ports = String(
                        block.getFieldValue("menu_KmTtvwKsxqccPDNHoIPt") ||
                            "12345678"
                    );

                    // 屏幕为 240(X) x 320(Y)，采用 2 列 x 4 行布局，可容纳 P1~P8
                    const layout = {
                        1: [0, 40],
                        2: [120, 40],
                        3: [0, 110],
                        4: [120, 110],
                        5: [0, 180],
                        6: [120, 180],
                        7: [0, 250],
                        8: [120, 250],
                    };

                    const draws = [];
                    for (let i = 1; i <= 8; i++) {
                        if (!ports.includes(String(i))) continue;
                        const [x, y] = layout[i];
                        draws.push(
                            `rcu.SetDisplayStringXY(${x}, ${y}, str("".join((str("".join(("P${i}：",str(servo.GetMagneticServoDegree(${i}))))),"   "))), 0x07FF, 0x0000, 0)`
                        );
                    }
                    if (draws.length === 0) draws.push("pass");

                    const initLines = [];
                    for (let i = 1; i <= 8; i++) {
                        initLines.push(`servo.SetMagneticServoMotor(${i}, 0)`);
                    }

                    const ind = (arr, n) =>
                        arr.map((l) => "    ".repeat(n) + l).join("\n");
                    const Py = ScratchBlocks.Python;

                    if (inPanel()) {
                        // 面板内：定义「每帧刷新」函数（只画一次，不循环），
                        // 并把初始化 + 注册语句交给任务体
                        const frameName = "_p_frame_angles_" + ports;
                        Py.functionNames_["面板-舵机角度刷新-" + ports] =
                            "\ndef " +
                            frameName +
                            "():\n" +
                            ind(draws, 1) +
                            "\n";

                        return (
                            initLines.map((l) => l + "\r\n").join("") +
                            "_p_live.append(" +
                            frameName +
                            ")\r\n"
                        );
                    }

                    // 面板外：保持原来的独立死循环显示方式
                    Py.functionNames_["显示舵机角度"] =
                        "\ndef show_angles():\n" +
                        ind(initLines, 1) +
                        "\n    while True:\n" +
                        ind(draws, 2) +
                        "\n";

                    return `show_angles()\r\n`;
                },
                block_MtKpWnQeRbXyZvLhJsDf: function (block) {
                    ScratchBlocks.Python.Import("motor");
                    ScratchBlocks.Python.Import("rcu");

                    const Py = ScratchBlocks.Python;
                    const ind = (arr, n) =>
                        arr.map((l) => "    ".repeat(n) + l).join("\n");

                    const reset = [
                        "motor.SetMotorCode(1)",
                        "motor.SetMotorCode(2)",
                        "motor.SetMotorCode(3)",
                        "motor.SetMotorCode(4)",
                    ];
                    // 数值位数变短时必须补空格盖掉上一次的高位数字，否则屏幕上会残留
                    // 旧数字（例：1500 -> 0 残留成「0500」），看起来就像数据不对。
                    // x=0 的两列右边空间充足，补 8 个空格；
                    // x=180 的两列右边紧贴屏幕边缘(240px)，超出部分本来就被裁掉，
                    // 保持原来的 3 个空格即可。
                    const PAD_L = "        "; // x=0 用，8 个空格
                    const PAD_R = "   "; // x=180 用，3 个空格
                    const draws = [
                        `rcu.SetDisplayStringXY(0, 40, str("".join((str("".join(("M1：",str(motor.GetMotorCode(1))))),"${PAD_L}"))), 0x07FF, 0x0000, 0)`,
                        `rcu.SetDisplayStringXY(180, 40, str("".join((str("".join(("M2：",str(motor.GetMotorCode(2))))),"${PAD_R}"))), 0x07FF, 0x0000, 0)`,
                        `rcu.SetDisplayStringXY(0, 240, str("".join((str("".join(("M3：",str(motor.GetMotorCode(3))))),"${PAD_L}"))), 0x07FF, 0x0000, 0)`,
                        `rcu.SetDisplayStringXY(180, 240, str("".join((str("".join(("M4：",str(motor.GetMotorCode(4))))),"${PAD_R}"))), 0x07FF, 0x0000, 0)`,
                    ];

                    // 平均值那一行原先完全没有补空格，是残留最明显的一行，补 8 个空格
                    const avgDraw = (varName) =>
                        'rcu.SetDisplayStringXY(0, 140, str("".join(("M1M2平均：", str(' +
                        varName +
                        '), "' +
                        PAD_L +
                        '"))), 0xFFE0, 0x0000, 0)';

                    if (inPanel()) {
                        // 面板内：定义「每帧刷新」函数，初始化 + 注册交给任务体
                        Py.functionNames_["面板-马达编码刷新"] =
                            "\ndef _p_frame_motor_code():\n" +
                            "    if rcu.GetLeftButton():\n" +
                            ind(reset, 2) +
                            "\n    _p_avg = int((motor.GetMotorCode(1) + motor.GetMotorCode(2)) / 2)\n" +
                            ind(draws, 1) +
                            "\n    " +
                            avgDraw("_p_avg") +
                            "\n";

                        return (
                            reset.map((l) => l + "\r\n").join("") +
                            "_p_live.append(_p_frame_motor_code)\r\n"
                        );
                    }

                    // 面板外：保持原来的独立死循环显示方式
                    Py.functionNames_["显示马达编码值"] =
                        "\ndef show_motor_code():\n" +
                        ind(reset, 1) +
                        "\n    while True:\n" +
                        "        if rcu.GetLeftButton():\n" +
                        ind(reset, 3) +
                        "\n        avg = int((motor.GetMotorCode(1) + motor.GetMotorCode(2)) / 2)\n" +
                        ind(draws, 2) +
                        "\n        " +
                        avgDraw("avg") +
                        "\n" +
                        "        rcu.SetWaitForTime(0.1)\n";

                    return `show_motor_code()\r\n`;
                },
                block_TnPvQmWsXrZkLdBfJhGc: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    const Py = ScratchBlocks.Python;

                    // 屏幕为 240(X) x 320(Y)，用 2 列 x 4 行划出 8 个任务格
                    // 实测：Y 轴向上增长，故「任务1在下方」对应 y 较小的一端
                    const dirUp =
                        String(block.getFieldValue("PANEL_DIR") || "2") === "1";
                    const rowYs = dirUp ? [250, 180, 110, 40] : [40, 110, 180, 250];
                    const colXs = [0, 120];
                    const cells = [];
                    for (let i = 0; i < 8; i++) {
                        cells.push([
                            colXs[i % 2],
                            rowYs[Math.floor(i / 2)],
                        ]);
                    }

                    // 8 个子堆栈 -> 8 个任务函数（SUBSTACK、SUBSTACK2 ... SUBSTACK8）
                    // 生成期间抬高 panelDepth：显示类积木会输出「每帧刷新」形式
                    const bodies = [];
                    for (let i = 1; i <= 8; i++) {
                        const inputName = i === 1 ? "SUBSTACK" : "SUBSTACK" + i;
                        panelDepth++;
                        let body = Py.statementToCode(block, inputName);
                        panelDepth--;
                        if (!body || !body.trim()) body = Py.INDENT + "pass\n";
                        bodies.push(Py.addIndentation(body));
                    }
                    // 任务函数内若用到变量，需要 global 声明（与自定义积木一致）
                    // 注意：Globals() 自身已带一层缩进，这里再补一层，
                    // 并去掉 def 行尾残留的空白
                    const globalsRaw = Py.Globals();
                    const globalsLine = globalsRaw
                        ? Py.addIndentation(globalsRaw).replace(
                              /^[ \t]*\n/,
                              "\n"
                          )
                        : "";

                    const taskDefs = bodies.map(function (body, idx) {
                        return (
                            "    def _p_task" +
                            (idx + 1) +
                            "():" +
                            globalsLine +
                            "\n" +
                            body
                        );
                    });

                    const I = "    "; // task_panel 函数体的一层缩进
                    const L = [];
                    L.push(
                        I +
                            "_p_cells = [" +
                            cells
                                .map(function (c) {
                                    return "(" + c[0] + ", " + c[1] + ")";
                                })
                                .join(", ") +
                            "]"
                    );
                    L.push(
                        I +
                            '_p_names = ["任务1", "任务2", "任务3", "任务4", "任务5", "任务6", "任务7", "任务8"]'
                    );
                    // _p_live = 本次选中的任务注册的「每帧刷新」函数列表
                    L.push(I + "_p_live = []");
                    L.push("");
                    L.push(I + "def _p_draw_panel():");
                    L.push(I + "    rcu.SetLCDClear(0x0000)");
                    L.push(I + "    for _p_i in range(8):");
                    L.push(
                        I +
                            "        rcu.SetDisplayStringXY(_p_cells[_p_i][0], _p_cells[_p_i][1], _p_names[_p_i], 0x07FF, 0x0000, 0)"
                    );
                    L.push("");
                    L.push(I + "_p_draw_panel()");
                    L.push(I + "while True:");
                    L.push(I + "    if rcu.GetTouchScreen():");
                    L.push(I + "        _p_x = rcu.GetTouchScreenX()");
                    L.push(I + "        _p_y = rcu.GetTouchScreenY()");
                    L.push(I + "        while rcu.GetTouchScreen():");
                    L.push(I + "            rcu.SetWaitForTime(0.05)");
                    // 找最近的格子
                    L.push(I + "        _p_sel = 0");
                    L.push(I + "        _p_best = 99999");
                    L.push(I + "        for _p_i in range(8):");
                    L.push(
                        I +
                            "            _p_d = abs(_p_x - _p_cells[_p_i][0]) + abs(_p_y - _p_cells[_p_i][1])"
                    );
                    L.push(I + "            if _p_d < _p_best:");
                    L.push(I + "                _p_best = _p_d");
                    L.push(I + "                _p_sel = _p_i + 1");
                    L.push(I + "        _p_live = []");
                    L.push(I + "        rcu.SetLCDClear(0x0000)");
                    L.push(I + "        if _p_sel == 8:");
                    for (let i = 1; i <= 8; i++) {
                        L.push(I + "            _p_task" + i + "()");
                    }
                    for (let i = 1; i <= 7; i++) {
                        L.push(I + "        elif _p_sel == " + i + ":");
                        L.push(I + "            _p_task" + i + "()");
                    }
                    // 任务注册了显示刷新函数 -> 屏幕交给它，只显示它自己的界面，
                    // 不再画任务格、也不再响应触摸（需要换任务请复位重跑）
                    L.push(I + "        if len(_p_live) > 0:");
                    L.push(I + "            while True:");
                    L.push(I + "                for _p_f in _p_live:");
                    L.push(I + "                    _p_f()");
                    L.push(I + "                rcu.SetWaitForTime(0.05)");
                    L.push(I + "        else:");
                    L.push(I + "            _p_draw_panel()");
                    L.push(I + "    rcu.SetWaitForTime(0.05)");

                    Py.functionNames_["任务面板"] =
                        "\ndef task_panel():\n" +
                        taskDefs.join("\n") +
                        "\n" +
                        L.join("\n") +
                        "\n";

                    return `task_panel()\r\n`;
                },
                block_SiteLearnQzXvBnMkLpRt: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("sensor");
                    ScratchBlocks.Python.Import("trace");

                    const Py = ScratchBlocks.Python;

                    // 0 = 自动（读 E007）  4 = 4 光电  7 = 循迹卡
                    const mode = String(block.getFieldValue("SITE_MODE") || "0");
                    let secs = "";
                    try {
                        secs = Py.valueToCode(block, "SITE_SEC", 16);
                    } catch (e) {
                        secs = "";
                    }
                    if (!secs) secs = "8";

                    // 面板里跑：结果停在屏幕上等你看完再返回（否则面板会立刻重绘把它盖掉）
                    const hold = inPanel() ? "1" : "0";

                    Py.functionNames_["场地学习"] = SITE_CORE;

                    return "site_learn(" + mode + ", " + secs + ", " + hold + ")\r\n";
                },
            },
        };
    }
    getInfo() {
        return {
            id: "TeStQmZxNvRbLhJdWkCp",
            name: "数据测试",
            color1: "#006eff",
            color2: "#0058cc",
            color3: "#0058cc",
            blockIconURI: this.imgs.blockIcon["TEST"],
            menuIconURI: this.imgs.menuIcon["TEST"],
            supportDevice: ["E6", "E7", "M6"],
            blocks: [
                {
                    opcode: "block_ZBtSNzlYrFppaVxQtmWO",
                    blockType: "command",
                    text: "释放所有舵机",
                },
                {
                    opcode: "block_vFKdnEQUZCVetfTBMaFH",
                    blockType: "command",
                    text: "显示舵机角度 [menu_KmTtvwKsxqccPDNHoIPt]",
                    arguments: {
                        menu_KmTtvwKsxqccPDNHoIPt: {
                            type: ArgumentType.STRING,
                            menu: "menu_KmTtvwKsxqccPDNHoIPt",
                            defaultValue: "12345678",
                        },
                    },
                },
                {
                    opcode: "block_TnPvQmWsXrZkLdBfJhGc",
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 8,
                    isTerminal: true,
                    text: [
                        "任务面板 [PANEL_DIR] · 任务1",
                        "任务2",
                        "任务3",
                        "任务4",
                        "任务5",
                        "任务6",
                        "任务7",
                        "任务8 · 点击后依次执行任务1到7",
                        "点击任务格执行；带显示积木的任务会独占屏幕显示数据",
                    ],
                    arguments: {
                        PANEL_DIR: {
                            type: ArgumentType.STRING,
                            menu: "menu_panel_dir",
                            defaultValue: "2",
                        },
                    },
                },
                {
                    opcode: "block_MtKpWnQeRbXyZvLhJsDf",
                    blockType: "command",
                    text: "显示马达编码值",
                },
                {
                    opcode: "block_SiteLearnQzXvBnMkLpRt",
                    blockType: "command",
                    text: "场地学习 [SITE_MODE] 扫描 [SITE_SEC] 秒",
                    arguments: {
                        SITE_MODE: {
                            type: ArgumentType.STRING,
                            menu: "menu_site_mode",
                            defaultValue: "0",
                        },
                        SITE_SEC: {
                            type: ArgumentType.NUMBER,
                            defaultValue: "8",
                        },
                    },
                },
            ],
            menus: {
                menu_KmTtvwKsxqccPDNHoIPt: "menu_KmTtvwKsxqccPDNHoIPt",
                menu_panel_dir: "menu_panel_dir",
                menu_site_mode: "menu_site_mode",
            },
        };
    }

    menu_KmTtvwKsxqccPDNHoIPt() {
        return [
            {
                text: "P1",
                value: "1",
            },
            {
                text: "P2",
                value: "2",
            },
            {
                text: "P3",
                value: "3",
            },
            {
                text: "P4",
                value: "4",
            },
            {
                text: "P5",
                value: "5",
            },
            {
                text: "P6",
                value: "6",
            },
            {
                text: "P7",
                value: "7",
            },
            {
                text: "P8",
                value: "8",
            },
            {
                text: "全部",
                value: "12345678",
            },
        ];
    }

    menu_panel_dir() {
        return [
            {
                text: "任务1在下方",
                value: "2",
            },
            {
                text: "任务1在上方",
                value: "1",
            },
        ];
    }

    menu_site_mode() {
        return [
            {
                text: "自动识别",
                value: "0",
            },
            {
                text: "4 光电",
                value: "4",
            },
            {
                text: "循迹卡",
                value: "7",
            },
        ];
    }

    block_xWknoQCrmKNXfagDMbhD(args) {}
    block_SDOoSPfptMHWVQfTGqXo(args) {}
    block_FjInpFeJYPtLtZVDyiWP(args) {}
    block_ZBtSNzlYrFppaVxQtmWO(args) {}
    block_vFKdnEQUZCVetfTBMaFH(args) {}
    block_MtKpWnQeRbXyZvLhJsDf(args) {}
    block_TnPvQmWsXrZkLdBfJhGc(args) {}
    block_SiteLearnQzXvBnMkLpRt(args) {}
    block_krwEtftxigXHZOKzoyHA(args) {}
}
(function () {
    return {
        TeStQmZxNvRbLhJdWkCp: TeStQmZxNvRbLhJdWkCpBlock,
    };
})();
