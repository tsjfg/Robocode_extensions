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

                    const lines = [];
                    for (let i = 1; i <= 8; i++) {
                        if (!ports.includes(String(i))) continue;
                        const [x, y] = layout[i];
                        lines.push(
                            `        rcu.SetDisplayStringXY(${x}, ${y}, str("".join((str("".join(("P${i}：",str(servo.GetMagneticServoDegree(${i}))))),"   "))), 0x07FF, 0x0000, 0)`
                        );
                    }
                    if (lines.length === 0) lines.push("        pass");

                    ScratchBlocks.Python.functionNames_["显示舵机角度"] = `
def show_angles():
    servo.SetMagneticServoMotor(1, 0)
    servo.SetMagneticServoMotor(2, 0)
    servo.SetMagneticServoMotor(3, 0)
    servo.SetMagneticServoMotor(4, 0)
    servo.SetMagneticServoMotor(5, 0)
    servo.SetMagneticServoMotor(6, 0)
    servo.SetMagneticServoMotor(7, 0)
    servo.SetMagneticServoMotor(8, 0)
    while True:
${lines.join("\n")}
`;

                    return `show_angles()\r\n`;
                },
                block_MtKpWnQeRbXyZvLhJsDf: function (block) {
                    ScratchBlocks.Python.Import("motor");
                    ScratchBlocks.Python.Import("rcu");

                    ScratchBlocks.Python.functionNames_["显示马达编码值"] = `
def show_motor_code():
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    motor.SetMotorCode(3)
    motor.SetMotorCode(4)
    while True:
        if rcu.GetLeftButton():
            motor.SetMotorCode(1)
            motor.SetMotorCode(2)
            motor.SetMotorCode(3)
            motor.SetMotorCode(4)
        avg = int((motor.GetMotorCode(1) + motor.GetMotorCode(2)) / 2)
        rcu.SetDisplayStringXY(0, 40, str("".join((str("".join(("M1：",str(motor.GetMotorCode(1))))),"   "))), 0x07FF, 0x0000, 0)
        rcu.SetDisplayStringXY(180, 40, str("".join((str("".join(("M2：",str(motor.GetMotorCode(2))))),"   "))), 0x07FF, 0x0000, 0)
        rcu.SetDisplayStringXY(0, 240, str("".join((str("".join(("M3：",str(motor.GetMotorCode(3))))),"   "))), 0x07FF, 0x0000, 0)
        rcu.SetDisplayStringXY(180, 240, str("".join((str("".join(("M4：",str(motor.GetMotorCode(4))))),"   "))), 0x07FF, 0x0000, 0)
        rcu.SetDisplayStringXY(0, 140, str("".join(("M1M2平均：", str(avg)))), 0xFFE0, 0x0000, 0)
        rcu.SetWaitForTime(0.1)
`;

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
                    const bodies = [];
                    for (let i = 1; i <= 8; i++) {
                        const inputName = i === 1 ? "SUBSTACK" : "SUBSTACK" + i;
                        let body = Py.statementToCode(block, inputName);
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
                    L.push("");
                    L.push(I + "def _p_draw():");
                    L.push(I + "    rcu.SetLCDClear(0x0000)");
                    L.push(I + "    for _p_i in range(8):");
                    L.push(
                        I +
                            "        rcu.SetDisplayStringXY(_p_cells[_p_i][0], _p_cells[_p_i][1], _p_names[_p_i], 0x07FF, 0x0000, 0)"
                    );
                    L.push("");
                    L.push(I + "_p_draw()");
                    L.push(I + "while True:");
                    L.push(I + "    if rcu.GetTouchScreen():");
                    L.push(I + "        _p_x = rcu.GetTouchScreenX()");
                    L.push(I + "        _p_y = rcu.GetTouchScreenY()");
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
                    L.push(I + "        while rcu.GetTouchScreen():");
                    L.push(I + "            rcu.SetWaitForTime(0.05)");
                    L.push(I + "        if _p_sel == 8:");
                    for (let i = 1; i <= 8; i++) {
                        L.push(I + "            _p_task" + i + "()");
                    }
                    for (let i = 1; i <= 7; i++) {
                        L.push(I + "        elif _p_sel == " + i + ":");
                        L.push(I + "            _p_task" + i + "()");
                    }
                    L.push(I + "        _p_draw()");
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
                        "点击屏幕上的任务格即可执行对应任务",
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
