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
            ],
            menus: {
                menu_KmTtvwKsxqccPDNHoIPt: "menu_KmTtvwKsxqccPDNHoIPt",
                menu_panel_dir: "menu_panel_dir",
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

    block_xWknoQCrmKNXfagDMbhD(args) {}
    block_SDOoSPfptMHWVQfTGqXo(args) {}
    block_FjInpFeJYPtLtZVDyiWP(args) {}
    block_ZBtSNzlYrFppaVxQtmWO(args) {}
    block_vFKdnEQUZCVetfTBMaFH(args) {}
    block_MtKpWnQeRbXyZvLhJsDf(args) {}
    block_TnPvQmWsXrZkLdBfJhGc(args) {}
    block_krwEtftxigXHZOKzoyHA(args) {}
}
(function () {
    return {
        TeStQmZxNvRbLhJdWkCp: TeStQmZxNvRbLhJdWkCpBlock,
    };
})();
