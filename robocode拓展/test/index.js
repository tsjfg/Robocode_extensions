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
`;

                    return `release_servos()\r\n`;
                },
                block_vFKdnEQUZCVetfTBMaFH: function (block) {
                    ScratchBlocks.Python.Import("servo");
                    ScratchBlocks.Python.Import("rcu");

                    const ports = String(
                        block.getFieldValue("menu_KmTtvwKsxqccPDNHoIPt") || "1234"
                    );

                    ScratchBlocks.Python.functionNames_["显示舵机角度"] = `
def show_angles():
    servo.SetMagneticServoMotor(1, 0)
    servo.SetMagneticServoMotor(2, 0)
    servo.SetMagneticServoMotor(3, 0)
    servo.SetMagneticServoMotor(4, 0)
    while True:
${
    ports.includes("1")
        ? `        rcu.SetDisplayStringXY(0, 40, str("".join((str("".join(("P1：",str(servo.GetMagneticServoDegree(1))))),"   "))), 0x07FF, 0x0000, 0)`
        : ""
}
${
    ports.includes("2")
        ? `        rcu.SetDisplayStringXY(180, 40, str("".join((str("".join(("P2：",str(servo.GetMagneticServoDegree(2))))),"   "))), 0x07FF, 0x0000, 0)`
        : ""
}
${
    ports.includes("3")
        ? `        rcu.SetDisplayStringXY(0, 240, str("".join((str("".join(("P3：",str(servo.GetMagneticServoDegree(3))))),"   "))), 0x07FF, 0x0000, 0)`
        : ""
}
${
    ports.includes("4")
        ? `        rcu.SetDisplayStringXY(180, 240, str("".join((str("".join(("P4：",str(servo.GetMagneticServoDegree(4))))),"   "))), 0x07FF, 0x0000, 0)`
        : ""
}
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
                    text: "显示舵机角度",
                    arguments: {
                        menu_KmTtvwKsxqccPDNHoIPt: {
                            type: "field_dropdown",
                            defaultValue: "1234",
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
                text: "全部",
                value: "1234",
            },
        ];
    }

    block_xWknoQCrmKNXfagDMbhD(args) {}
    block_SDOoSPfptMHWVQfTGqXo(args) {}
    block_FjInpFeJYPtLtZVDyiWP(args) {}
    block_ZBtSNzlYrFppaVxQtmWO(args) {}
    block_vFKdnEQUZCVetfTBMaFH(args) {}
    block_MtKpWnQeRbXyZvLhJsDf(args) {}
    block_krwEtftxigXHZOKzoyHA(args) {}
}
(function () {
    return {
        TeStQmZxNvRbLhJdWkCp: TeStQmZxNvRbLhJdWkCpBlock,
    };
})();
