const { ArgumentType, BlockType, ScratchBlocks, formatMessage, send } =
    window.Scratch;

class OMEOGiWRIHpRTBrbIlzvBlock {
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
                block_xWknoQCrmKNXfagDMbhD: function (block) {
                    (ScratchBlocks.Python.Import("servo"),
                        ScratchBlocks.Python.Import("rcu"));

                    ((ScratchBlocks.Python.definition_variables["var_speed"] =
                        "var_speed=80"),
                        (ScratchBlocks.Python.definition_variables["var_time"] =
                            "var_time=0.15"));

                    ScratchBlocks.Python.functionNames_["初始化"] = `
def set_legs(pose):
    global var_speed, var_time
    if pose[0] is not None:
        servo.SetMagneticServoDegreeSpeed(1, (90 + pose[0]) % 360, var_speed)
    if pose[1] is not None:
        servo.SetMagneticServoDegreeSpeed(2, (270 - pose[1]) % 360, var_speed)
    if pose[2] is not None:
        servo.SetMagneticServoDegreeSpeed(3, (270 + pose[2]) % 360, var_speed)
    if pose[3] is not None:
        servo.SetMagneticServoDegreeSpeed(4, (90 - pose[3]) % 360, var_speed)
    rcu.SetWaitForTime(var_time)
`;

                    return `set_legs([0, 0, 0, 0]) 
rcu.SetWaitForTime(0.3)\r\n`;
                },
                block_gYAyhNgteHXamAiFyjET: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    let steps = ScratchBlocks.Python.valueToCode(
                        block,
                        "steps",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_["前进_次"] = `
def walk_forward(steps):
    for _ in range(steps):
        set_legs([  0, 40, 40,  0])
        set_legs([-40, 40, 40,-40])
        set_legs([-40,  0,  0,-40])
        set_legs([  0,  0,  0,  0])
        set_legs([ 40,  0,  0, 40])
        set_legs([ 40,-40,-40, 40])
        set_legs([  0,-40,-40,  0])
        set_legs([  0,  0,  0,  0])
    rcu.SetWaitForTime(0.2)
`;

                    return `walk_forward(${steps})\r\n`;
                },
                block_lUptLxwdWVbJduoSvcqE: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    let steps = ScratchBlocks.Python.valueToCode(
                        block,
                        "steps",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_["后退_次"] = `
def walk_backward(steps):
    for _ in range(steps):
        set_legs([  0,-40,-40,  0])
        set_legs([ 40,-40,-40, 40])
        set_legs([ 40,  0,  0, 40])
        set_legs([  0,  0,  0,  0])
        set_legs([-40,  0,  0,-40])
        set_legs([-40, 40, 40,-40])
        set_legs([  0, 40, 40,  0])
        set_legs([  0,  0,  0,  0])
    rcu.SetWaitForTime(0.2)
`;

                    return `walk_backward(${steps})\r\n`;
                },
                block_SaGHLnRoDPTPIRNcBMlr: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    let steps = ScratchBlocks.Python.valueToCode(
                        block,
                        "steps",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_["左转_次"] = `
def turn_left(steps):
    for _ in range(steps * 6):
        set_legs([-30,  0,  0, 30])
        set_legs([-30,-30, 30, 30])
        set_legs([  0,-30, 30,  0])
        set_legs([  0,  0,  0,  0])
    rcu.SetWaitForTime(0.2)
`;

                    return `turn_left(${steps})\r\n`;
                },
                block_PRdlLwMAyNpLtldFsjcO: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    let steps = ScratchBlocks.Python.valueToCode(
                        block,
                        "steps",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_["右转_次"] = `
def turn_right(steps):
    for _ in range(steps *6):
        set_legs([  0,-30, 30,  0])
        set_legs([-30,-30, 30, 30])
        set_legs([-30,  0,  0, 30])
        set_legs([  0,  0,  0,  0])
    rcu.SetWaitForTime(0.2)
`;

                    return `turn_right(${steps})\r\n`;
                },
                block_nglXeKBOATQYaoJVrOxE: function (block) {
                    ScratchBlocks.Python.functionNames_["站立"] = `
def stand_upright():
    set_legs([0, 0, 0, 0])
    rcu.SetWaitForTime(0.2)
`;

                    return `stand_upright()\r\n`;
                },
                block_vGyyqrBZWnUxmmcBNyDV: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    ScratchBlocks.Python.functionNames_["坐下"] = `
def sit_down():
    set_legs([0, 0, 40, 40])
    rcu.SetWaitForTime(0.2)
`;

                    return `sit_down()\r\n`;
                },
                block_tgXrdzYfILBjmsPNdylq: function (block) {
                    ScratchBlocks.Python.functionNames_["趴下"] = `
def lie_down():
    set_legs([80, 80, 80, 80])
    rcu.SetWaitForTime(0.2)
`;

                    return `lie_down()\r\n`;
                },
                block_qWmRtYbNcXzLpHjKvFsDgE: function (block) {
                    ScratchBlocks.Python.Import("rcu");

                    let sound_type = block.getFieldValue("sound_type");

                    ScratchBlocks.Python.functionNames_["狗叫_"] = `
def bark(sound_type):
    if sound_type == 1:
        rcu.SetAudioPlay("xm4077.mp3")
    elif sound_type == 2:
        rcu.SetAudioPlay("xm4081.mp3")
`;

                    return `bark(${sound_type})\r\n`;
                },
                block_wNvekYAMPuaIJHExgTIu: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("time"));

                    let action_type = block.getFieldValue("action_type");

                    ScratchBlocks.Python.functionNames_["执行动作_"] = `
def push_front():
    set_legs([0, 0, 0, 0])
    set_legs([-40, -40, -50, -50])
    set_legs([0, 0, 0, 0])

def push_rear():
    set_legs([0, 0, 0, 0])
    set_legs([50, 50, 40, 40])
    set_legs([0, 0, 0, 0])

def wave_left():
    set_legs([0, 0, 0, 0])
    set_legs([45, 45, 45, -45])
    for count in range(6):
        set_legs([100, None, None, None])
        rcu.SetWaitForTime(0.1)
        set_legs([60, None, None, None])
    rcu.SetWaitForTime(0.5)
    set_legs([0, 0, 0, 0])

def wave_right():
    set_legs([0, 0, 0, 0])
    set_legs([45, 45, -45, 45])
    for count in range(6):
        set_legs([None, 100, None, None])
        rcu.SetWaitForTime(0.1)
        set_legs([None, 60, None, None])
    rcu.SetWaitForTime(0.5)
    set_legs([0, 0, 0, 0])

def sway():
    global var_speed,var_time
    set_legs([0, 0, 0, 0])
    rcu.SetWaitForTime(0.5)
    for count in range(5):
        set_legs([30, 30, 30, 30])
        set_legs([-30, -30, -30, -30])
    rcu.SetWaitForTime(0.5)
    set_legs([0, 0, 0, 0])

def action(action_type):
    if action_type == 1: push_front()
    elif action_type == 2: push_rear()
    elif action_type == 3: wave_left()
    elif action_type == 4: wave_right()
    elif action_type == 5: sway()

`;

                    return `action(${action_type})\r\n`;
                },
                block_SDOoSPfptMHWVQfTGqXo: function (block) {
                    (ScratchBlocks.Python.Import("servo"),
                        ScratchBlocks.Python.Import("rcu"));

                    let leg_num = block.getFieldValue("leg_num");
                    let angle = ScratchBlocks.Python.valueToCode(
                        block,
                        "angle",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_["_抬起_度"] = `
def set_leg_angle(leg_num, angle):
    global var_time
    temp_time = var_time
    var_time = 0

    if leg_num == 1 :
        set_legs([angle, None, None, None])
    elif leg_num == 2 :
        set_legs([None, angle, None, None])
    elif leg_num == 3 :
        set_legs([None, None, angle, None])
    elif leg_num == 4 :
        set_legs([None, None, None, angle])
    elif leg_num == 1234 :
        set_legs([angle, angle, angle, angle])
        
    var_time = temp_time
`;

                    return `set_leg_angle(${leg_num}, ${angle})\r\n`;
                },
                block_FjInpFeJYPtLtZVDyiWP: function (block) {
                    let LF = ScratchBlocks.Python.valueToCode(block, "LF", 16);
                    let RF = ScratchBlocks.Python.valueToCode(block, "RF", 16);
                    let LB = ScratchBlocks.Python.valueToCode(block, "LB", 16);
                    let RB = ScratchBlocks.Python.valueToCode(block, "RB", 16);

                    ScratchBlocks.Python.functionNames_[
                        "将姿势设为左手_右手_左脚_右脚_"
                    ] = ``;

                    return `set_legs([${LF}, ${RF}, ${LB}, ${RB}])\r\n`;
                },
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
                    ScratchBlocks.Python.Import("rcu");

                    ScratchBlocks.Python.functionNames_["显示当前角度"] = `
def show_angles():
    rcu.SetDisplayStringXY(0, 40, str("".join((str("".join(("P1：",str(servo.GetMagneticServoDegree(1))))),"   "))), 0x07FF, 0x0000, 0)
    rcu.SetDisplayStringXY(180, 40, str("".join((str("".join(("P2：",str(servo.GetMagneticServoDegree(2))))),"   "))), 0x07FF, 0x0000, 0)
    rcu.SetDisplayStringXY(0, 240, str("".join((str("".join(("P3：",str(servo.GetMagneticServoDegree(3))))),"   "))), 0x07FF, 0x0000, 0)
    rcu.SetDisplayStringXY(180, 240, str("".join((str("".join(("P4：",str(servo.GetMagneticServoDegree(4))))),"   "))), 0x07FF, 0x0000, 0)
`;

                    return `show_angles()\r\n`;
                },
                block_krwEtftxigXHZOKzoyHA: function (block) {
                    let speed = ScratchBlocks.Python.valueToCode(
                        block,
                        "speed",
                        16,
                    );
                    let time = ScratchBlocks.Python.valueToCode(
                        block,
                        "time",
                        16,
                    );

                    ScratchBlocks.Python.functionNames_[
                        "将速度设为_节拍设为_秒"
                    ] = `
def set_speed(speed,time):
    global var_speed, var_time
    var_speed=speed
    var_time=time
`;

                    return `set_speed(${speed}, ${time})\r\n`;
                },
            },
        };
    }
    getInfo() {
        return {
            id: "OMEOGiWRIHpRTBrbIlzv",
            name: "舵机狗",
            color1: "#006eff",
            color2: "#0058cc",
            color3: "#0058cc",
            blockIconURI: this.imgs.blockIcon["DOG"],
            menuIconURI: this.imgs.menuIcon["DOG"],
            supportDevice: ["E6", "E7", "M6"],
            blocks: [
                {
                    opcode: "block_xWknoQCrmKNXfagDMbhD",
                    blockType: "command",
                    text: "初始化",
                },
                {
                    opcode: "block_gYAyhNgteHXamAiFyjET",
                    blockType: "command",
                    text: "前进 [steps] 次",
                    arguments: {
                        steps: {
                            type: "number",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_lUptLxwdWVbJduoSvcqE",
                    blockType: "command",
                    text: "后退 [steps] 次",
                    arguments: {
                        steps: {
                            type: "number",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_SaGHLnRoDPTPIRNcBMlr",
                    blockType: "command",
                    text: "左转 [steps] 次",
                    arguments: {
                        steps: {
                            type: "number",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_PRdlLwMAyNpLtldFsjcO",
                    blockType: "command",
                    text: "右转 [steps] 次",
                    arguments: {
                        steps: {
                            type: "number",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_nglXeKBOATQYaoJVrOxE",
                    blockType: "command",
                    text: "站立",
                },
                {
                    opcode: "block_vGyyqrBZWnUxmmcBNyDV",
                    blockType: "command",
                    text: "坐下",
                },
                {
                    opcode: "block_tgXrdzYfILBjmsPNdylq",
                    blockType: "command",
                    text: "趴下",
                },
                {
                    opcode: "block_qWmRtYbNcXzLpHjKvFsDgE",
                    blockType: "command",
                    text: "狗叫 [sound_type]",
                    arguments: {
                        sound_type: {
                            type: "string",
                            menu: "menu_yXbNcVzLpHjKsDgFwQmRtE",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_wNvekYAMPuaIJHExgTIu",
                    blockType: "command",
                    text: "执行动作 [action_type]",
                    arguments: {
                        action_type: {
                            type: "string",
                            menu: "menu_KjqRspNroStLcgLtkFxU",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_SDOoSPfptMHWVQfTGqXo",
                    blockType: "command",
                    text: "[leg_num] 抬起 [angle] 度",
                    arguments: {
                        leg_num: {
                            type: "string",
                            menu: "menu_KmTtvwKsxqccPDNHoIPt",
                            defaultValue: "1",
                        },
                        angle: {
                            type: "number",
                            defaultValue: "45",
                        },
                    },
                },
                {
                    opcode: "block_FjInpFeJYPtLtZVDyiWP",
                    blockType: "command",
                    text: "将姿势设为左手 [LF] 右手 [RF] 左脚 [LB] 右脚 [RB]",
                    arguments: {
                        LF: {
                            type: "number",
                            defaultValue: "45",
                        },
                        RF: {
                            type: "number",
                            defaultValue: "45",
                        },
                        LB: {
                            type: "number",
                            defaultValue: "45",
                        },
                        RB: {
                            type: "number",
                            defaultValue: "45",
                        },
                    },
                },
                {
                    opcode: "block_ZBtSNzlYrFppaVxQtmWO",
                    blockType: "command",
                    text: "释放所有舵机",
                },
                {
                    opcode: "block_vFKdnEQUZCVetfTBMaFH",
                    blockType: "command",
                    text: "显示当前角度",
                },
                {
                    opcode: "block_krwEtftxigXHZOKzoyHA",
                    blockType: "command",
                    text: "将速度设为 [speed]，节拍设为 [time]秒",
                    arguments: {
                        speed: {
                            type: "number",
                            defaultValue: "80",
                        },
                        time: {
                            type: "number",
                            defaultValue: "0.15",
                        },
                    },
                },
            ],
            menus: {
                menu_KjqRspNroStLcgLtkFxU: "menu_KjqRspNroStLcgLtkFxU",
                menu_KmTtvwKsxqccPDNHoIPt: "menu_KmTtvwKsxqccPDNHoIPt",
                menu_yXbNcVzLpHjKsDgFwQmRtE: "menu_yXbNcVzLpHjKsDgFwQmRtE",
            },
        };
    }

    menu_KjqRspNroStLcgLtkFxU() {
        return [
            {
                text: "前顶",
                value: "1",
            },
            {
                text: "后顶",
                value: "2",
            },
            {
                text: "左挥手",
                value: "3",
            },
            {
                text: "右挥手",
                value: "4",
            },
            {
                text: "摇摆",
                value: "5",
            },
        ];
    }
    menu_KmTtvwKsxqccPDNHoIPt() {
        return [
            {
                text: "左手",
                value: "1",
            },
            {
                text: "右手",
                value: "2",
            },
            {
                text: "左脚",
                value: "3",
            },
            {
                text: "右脚",
                value: "4",
            },
            {
                text: "全部",
                value: "1234",
            },
        ];
    }

    menu_yXbNcVzLpHjKsDgFwQmRtE() {
        return [
            {
                text: "叫声1",
                value: "1",
            },
            {
                text: "叫声2",
                value: "2",
            },
        ];
    }

    block_xWknoQCrmKNXfagDMbhD(args) {}
    block_gYAyhNgteHXamAiFyjET(args) {}
    block_lUptLxwdWVbJduoSvcqE(args) {}
    block_SaGHLnRoDPTPIRNcBMlr(args) {}
    block_PRdlLwMAyNpLtldFsjcO(args) {}
    block_nglXeKBOATQYaoJVrOxE(args) {}
    block_vGyyqrBZWnUxmmcBNyDV(args) {}
    block_tgXrdzYfILBjmsPNdylq(args) {}
    block_qWmRtYbNcXzLpHjKvFsDgE(args) {}
    block_wNvekYAMPuaIJHExgTIu(args) {}
    block_SDOoSPfptMHWVQfTGqXo(args) {}
    block_FjInpFeJYPtLtZVDyiWP(args) {}
    block_ZBtSNzlYrFppaVxQtmWO(args) {}
    block_vFKdnEQUZCVetfTBMaFH(args) {}
    block_krwEtftxigXHZOKzoyHA(args) {}
}
(function () {
    return {
        OMEOGiWRIHpRTBrbIlzv: OMEOGiWRIHpRTBrbIlzvBlock,
    };
})();
