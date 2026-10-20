const { ArgumentType, BlockType, ScratchBlocks, formatMessage, send } =
    window.Scratch;

class MecanumWheelExt26ZBlock {
    constructor(runtime) {
        this.runtime = runtime;
    }

    static _generateCode() {
        return {
            Python: {
                block_mcInit7Qz2XpKm: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("math");
                    ScratchBlocks.Python.Import("time");
                    ScratchBlocks.Python.definition_variables["mc_maxspeed"] = "mc_maxspeed = 100";
                    ScratchBlocks.Python.definition_variables["mc_wheel_r"] = "mc_wheel_r = 3.0";
                    ScratchBlocks.Python.definition_variables["mc_enc_lines"] = "mc_enc_lines = 360";
                    ScratchBlocks.Python.definition_variables["mc_turn_c"] = "mc_turn_c = 0.222";
                    ScratchBlocks.Python.definition_variables["mc_min_spd"] = "mc_min_spd = 30";
                    ScratchBlocks.Python.definition_variables["mc_wheel_dir"] = "mc_wheel_dir = [1, 1, 1, 1]";
                    ScratchBlocks.Python.definition_variables["mc_inv"] = "mc_inv = 0";
                    ScratchBlocks.Python.definition_variables["mc_laste"] = "mc_laste = 0";
                    ScratchBlocks.Python.definition_variables["mc_ppc"] = "mc_ppc = 19.1";
                    ScratchBlocks.Python.functionNames_["麦轮底盘运行时"] = `
def mc_setup():
    global mc_laste
    mc_ppc = mc_enc_lines / (3.1415926 * 2.0 * mc_wheel_r)
    mc_laste = 0
    mc_stop()

def mc_apply(i, spd):
    v = int(spd * mc_wheel_dir[i])
    if v > 100:
        v = 100
    if v < -100:
        v = -100
    rcu.SetMotor(i + 1, v)

def mc_set4(a, b, c, d):
    mc_apply(0, a)
    mc_apply(1, b)
    mc_apply(2, c)
    mc_apply(3, d)

def mc_stop():
    mc_set4(0, 0, 0, 0)

def mc_set_max(v):
    global mc_maxspeed
    mc_maxspeed = v

def mc_calib(r, enc, turnc):
    global mc_wheel_r, mc_enc_lines, mc_turn_c, mc_ppc
    mc_wheel_r = r
    mc_enc_lines = enc
    mc_turn_c = turnc
    mc_ppc = mc_enc_lines / (3.1415926 * 2.0 * mc_wheel_r)

def mc_dir_fix(a, b, c, d):
    global mc_wheel_dir
    mc_wheel_dir = [a, b, c, d]

def mc_set_inv(v):
    global mc_inv
    mc_inv = v

def mc_angle(speed, angle):
    a = angle * 0.01745
    v = speed * 0.7
    mc_set4(v * (math.sin(a) + math.cos(a)),
            v * (math.cos(a) - math.sin(a)),
            v * (math.cos(a) - math.sin(a)),
            v * (math.sin(a) + math.cos(a)))

def mc_sensor(n):
    v = rcu.GetTraceV2I2C(1, 9)
    b = (v >> (n - 1)) & 1
    if mc_inv > 0:
        b = 1 - b
    return b

def mc_until(mode, speed, sensor, timeout):
    if mode == 0:
        mc_set4(-speed, speed, -speed, speed)
    elif mode == 1:
        mc_set4(speed, -speed, speed, -speed)
    elif mode == 2:
        mc_set4(speed, speed, speed, speed)
    else:
        mc_set4(speed, -speed, -speed, speed)
    t0 = time.time()
    while time.time() - t0 < timeout:
        if mc_sensor(sensor) > 0:
            break
        rcu.SetWaitForTime(0.005)
    mc_stop()

def mc_dist_cm():
    if mc_ppc <= 0:
        return 0
    c1 = abs(rcu.GetMotorCode(1))
    c2 = abs(rcu.GetMotorCode(2))
    c3 = abs(rcu.GetMotorCode(3))
    c4 = abs(rcu.GetMotorCode(4))
    return (c1 + c2 + c3 + c4) / 4.0 / mc_ppc

def mc_zero_code():
    rcu.SetMotorCode(1)
    rcu.SetMotorCode(2)
    rcu.SetMotorCode(3)
    rcu.SetMotorCode(4)

def mc_ramp(st, ms, step):
    st = st + step
    if st > ms:
        st = ms
    return st

def mc_move(mode, speed, dist):
    if dist <= 0:
        return
    s = 1 if speed >= 0 else -1
    ms = abs(speed)
    if mode == 1:
        d1, d2, d3, d4 = s, -s, -s, s
    else:
        d1, d2, d3, d4 = s, s, s, s
    mc_zero_code()
    st = mc_min_spd
    step = ms / 10.0
    if step < 1:
        step = 1
    guard = 3.0 + dist * 0.8
    tg = time.time()
    while True:
        rcu.SetWaitForTime(0.01)
        if time.time() - tg > guard:
            break
        d = mc_dist_cm()
        if d >= dist:
            break
        remain = dist - d
        sc = 1.0
        if remain < 3.0:
            sc = remain / 3.0
            if sc < 0.3:
                sc = 0.3
        cs = int(st * sc)
        if cs < mc_min_spd:
            cs = mc_min_spd
        if st < ms:
            st = mc_ramp(st, ms, step)
        c1 = abs(rcu.GetMotorCode(1))
        c2 = abs(rcu.GetMotorCode(2))
        c3 = abs(rcu.GetMotorCode(3))
        c4 = abs(rcu.GetMotorCode(4))
        if mode == 1:
            al = (c1 + c4) / 2.0
            ar = (c2 + c3) / 2.0
            e1 = (al - c1) / 8.0
            e4 = (al - c4) / 8.0
            e2 = (ar - c2) / 8.0
            e3 = (ar - c3) / 8.0
        else:
            ad = (c1 + c2 + c3 + c4) / 4.0
            e1 = (ad - c1) / 8.0
            e2 = (ad - c2) / 8.0
            e3 = (ad - c3) / 8.0
            e4 = (ad - c4) / 8.0
        v1 = int(cs + e1)
        v2 = int(cs + e2)
        v3 = int(cs + e3)
        v4 = int(cs + e4)
        if v1 < mc_min_spd:
            v1 = mc_min_spd
        if v2 < mc_min_spd:
            v2 = mc_min_spd
        if v3 < mc_min_spd:
            v3 = mc_min_spd
        if v4 < mc_min_spd:
            v4 = mc_min_spd
        mc_set4(d1 * v1, d2 * v2, d3 * v3, d4 * v4)
    mc_stop()

def mc_move_kt(speed, dist, kt):
    if dist <= 0:
        return
    s = 1 if speed >= 0 else -1
    sp = abs(speed)
    mc_zero_code()
    guard = 3.0 + dist * 0.8
    tg = time.time()
    while True:
        rcu.SetWaitForTime(0.01)
        if time.time() - tg > guard:
            break
        d = mc_dist_cm()
        if d >= dist:
            break
        remain = dist - d
        sc = 1.0
        if remain < 3.0:
            sc = remain / 3.0
            if sc < 0.15:
                sc = 0.15
        mc_set4(s * (-sp + kt) * sc, s * (sp + kt) * sc, s * (sp + kt) * sc, s * (-sp + kt) * sc)
    mc_stop()

def mc_turn(speed, angle):
    if angle == 0:
        return
    s = 1 if angle > 0 else -1
    a = abs(angle)
    mc_zero_code()
    st = mc_min_spd
    ms = abs(speed)
    step = ms / 10.0
    if step < 1:
        step = 1
    td = a * mc_turn_c
    guard = 3.0 + a * 0.08
    tg = time.time()
    while True:
        rcu.SetWaitForTime(0.01)
        if time.time() - tg > guard:
            break
        d = mc_dist_cm()
        if d >= td:
            break
        remain = td - d
        sc = 1.0
        if remain < 0.2 * td:
            sc = remain / (0.2 * td)
            if sc < 0.3:
                sc = 0.3
        cs = int(st * sc)
        if cs < mc_min_spd:
            cs = mc_min_spd
        if st < ms:
            st = mc_ramp(st, ms, step)
        mc_set4(s * cs, -s * cs, s * cs, -s * cs)
    mc_stop()

def mc_line_pd(speed, kp, kd):
    global mc_laste
    rcu.SetWaitForTime(0.01)
    a = rcu.GetTraceV2I2C(1, 3)
    b = rcu.GetTraceV2I2C(1, 5)
    e = a - b
    out = (kp * e + kd * (e - mc_laste)) / 35.0
    mc_laste = e
    if mc_inv > 0:
        mc_set4(speed + out, speed - out, speed + out, speed - out)
    else:
        mc_set4(speed - out, speed + out, speed - out, speed + out)

def mc_line(speed, kp, kd, seconds):
    global mc_laste
    mc_laste = 0
    t0 = time.time()
    while time.time() - t0 < seconds:
        mc_line_pd(speed, kp, kd)
    mc_stop()

def mc_line_until(sensor, speed, kp, kd, timeout):
    global mc_laste
    mc_laste = 0
    t0 = time.time()
    while time.time() - t0 < timeout:
        if mc_sensor(sensor) > 0:
            break
        mc_line_pd(speed, kp, kd)
    mc_stop()
`;
                    return `mc_setup()\r\n`;
                },
                block_mcMax3Kd8WnRt: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    let v = ScratchBlocks.Python.valueToCode(block, "v", 16);
                    return `mc_set_max(${v})\r\n`;
                },
                block_mcCali5Fv9LmYb: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    let r = ScratchBlocks.Python.valueToCode(block, "r", 16);
                    let n = ScratchBlocks.Python.valueToCode(block, "n", 16);
                    let c = ScratchBlocks.Python.valueToCode(block, "c", 16);
                    return `mc_calib(${r}, ${n}, ${c})\r\n`;
                },
                block_mcDir2Hg7RtQw: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    let a = ScratchBlocks.Python.valueToCode(block, "a", 16);
                    let b = ScratchBlocks.Python.valueToCode(block, "b", 16);
                    let c = ScratchBlocks.Python.valueToCode(block, "c", 16);
                    let d = ScratchBlocks.Python.valueToCode(block, "d", 16);
                    return `mc_dir_fix(${a}, ${b}, ${c}, ${d})\r\n`;
                },
                block_mcInv6Ys4QbZp: function (block) {
                    let inv = block.getFieldValue("inv");
                    return `mc_set_inv(${inv})\r\n`;
                },
                block_mcStop9Nw3KxLu: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    return `mc_stop()\r\n`;
                },
                block_mcAngle1Lj5TaCe: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("math");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let angle = ScratchBlocks.Python.valueToCode(block, "angle", 16);
                    return `mc_angle(${speed}, ${angle})\r\n`;
                },
                block_mcFwd8Rb2CeMd: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let dist = ScratchBlocks.Python.valueToCode(block, "dist", 16);
                    return `mc_move(0, ${speed}, ${dist})\r\n`;
                },
                block_mcStrafe4Pd7VgNh: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let dist = ScratchBlocks.Python.valueToCode(block, "dist", 16);
                    return `mc_move(1, ${speed}, ${dist})\r\n`;
                },
                block_mcStrafeKt3Wm8DyXj: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let dist = ScratchBlocks.Python.valueToCode(block, "dist", 16);
                    let kt = ScratchBlocks.Python.valueToCode(block, "kt", 16);
                    return `mc_move_kt(${speed}, ${dist}, ${kt})\r\n`;
                },
                block_mcTurn6Zq1HsFa: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let angle = ScratchBlocks.Python.valueToCode(block, "angle", 16);
                    return `mc_turn(${speed}, ${angle})\r\n`;
                },
                block_mcUntil7Tf4NuKr: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let mode = block.getFieldValue("mode");
                    let sensor = block.getFieldValue("sensor");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let timeout = ScratchBlocks.Python.valueToCode(block, "timeout", 16);
                    return `mc_until(${mode}, ${speed}, ${sensor}, ${timeout})\r\n`;
                },
                block_mcLinePd2Yb9RkQt: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let kp = ScratchBlocks.Python.valueToCode(block, "kp", 16);
                    let kd = ScratchBlocks.Python.valueToCode(block, "kd", 16);
                    return `mc_line_pd(${speed}, ${kp}, ${kd})\r\n`;
                },
                block_mcLineT5Xc3PaVm: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let kp = ScratchBlocks.Python.valueToCode(block, "kp", 16);
                    let kd = ScratchBlocks.Python.valueToCode(block, "kd", 16);
                    let sec = ScratchBlocks.Python.valueToCode(block, "sec", 16);
                    return `mc_line(${speed}, ${kp}, ${kd}, ${sec})\r\n`;
                },
                block_mcLineU9Lp4WsBn: function (block) {
                    ScratchBlocks.Python.Import("rcu");
                    ScratchBlocks.Python.Import("time");
                    let sensor = block.getFieldValue("sensor");
                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let kp = ScratchBlocks.Python.valueToCode(block, "kp", 16);
                    let kd = ScratchBlocks.Python.valueToCode(block, "kd", 16);
                    let timeout = ScratchBlocks.Python.valueToCode(block, "timeout", 16);
                    return `mc_line_until(${sensor}, ${speed}, ${kp}, ${kd}, ${timeout})\r\n`;
                },
            },
        };
    }
    getInfo() {
        return {
            id: "MecanumWheelExt26Z",
            name: "麦轮底盘",
            color1: "#0F6E56",
            color2: "#085041",
            color3: "#04342C",
            blockIconURI: this.imgs.blockIcon["MC"],
            menuIconURI: this.imgs.menuIcon["MC"],
            supportDevice: ["E6", "E7", "M6"],
            blocks: [
                {
                    opcode: "block_mcInit7Qz2XpKm",
                    blockType: "command",
                    text: "初始化麦轮底盘",
                },
                {
                    opcode: "block_mcMax3Kd8WnRt",
                    blockType: "command",
                    text: "设置最大速度 [v]",
                    arguments: {
                        v: { type: "number", defaultValue: "100" },
                    },
                },
                {
                    opcode: "block_mcCali5Fv9LmYb",
                    blockType: "command",
                    text: "标定 轮径 [r] cm 编码器线数 [n] 每度行驶 [c] cm",
                    arguments: {
                        r: { type: "number", defaultValue: "3" },
                        n: { type: "number", defaultValue: "360" },
                        c: { type: "number", defaultValue: "0.222" },
                    },
                },
                {
                    opcode: "block_mcDir2Hg7RtQw",
                    blockType: "command",
                    text: "四轮方向修正 FL [a] FR [b] BL [c] BR [d]",
                    arguments: {
                        a: { type: "number", defaultValue: "1" },
                        b: { type: "number", defaultValue: "1" },
                        c: { type: "number", defaultValue: "1" },
                        d: { type: "number", defaultValue: "1" },
                    },
                },
                {
                    opcode: "block_mcInv6Ys4QbZp",
                    blockType: "command",
                    text: "灰度反色 [inv]",
                    arguments: {
                        inv: { type: "string", menu: "menu_mcInv", defaultValue: "0" },
                    },
                },
                {
                    opcode: "block_mcStop9Nw3KxLu",
                    blockType: "command",
                    text: "停车",
                },
                {
                    opcode: "block_mcAngle1Lj5TaCe",
                    blockType: "command",
                    text: "按角度移动 速度 [speed] 方向 [angle] 度",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        angle: { type: "number", defaultValue: "90" },
                    },
                },
                {
                    opcode: "block_mcFwd8Rb2CeMd",
                    blockType: "command",
                    text: "直行 速度 [speed] 距离 [dist] cm",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        dist: { type: "number", defaultValue: "10" },
                    },
                },
                {
                    opcode: "block_mcStrafe4Pd7VgNh",
                    blockType: "command",
                    text: "侧移 速度 [speed] 距离 [dist] cm",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        dist: { type: "number", defaultValue: "10" },
                    },
                },
                {
                    opcode: "block_mcStrafeKt3Wm8DyXj",
                    blockType: "command",
                    text: "斜移 速度 [speed] 距离 [dist] cm 旋转分量 [kt]",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        dist: { type: "number", defaultValue: "10" },
                        kt: { type: "number", defaultValue: "0" },
                    },
                },
                {
                    opcode: "block_mcTurn6Zq1HsFa",
                    blockType: "command",
                    text: "转向 速度 [speed] 角度 [angle] 度",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        angle: { type: "number", defaultValue: "90" },
                    },
                },
                {
                    opcode: "block_mcUntil7Tf4NuKr",
                    blockType: "command",
                    text: "运动到灰度 [mode] 速度 [speed] 传感器 [sensor] 超时 [timeout] 秒",
                    arguments: {
                        mode: { type: "string", menu: "menu_mcMode", defaultValue: "2" },
                        speed: { type: "number", defaultValue: "50" },
                        sensor: { type: "string", menu: "menu_mcSensor", defaultValue: "4" },
                        timeout: { type: "number", defaultValue: "3" },
                    },
                },
                {
                    opcode: "block_mcLinePd2Yb9RkQt",
                    blockType: "command",
                    text: "巡线 速度 [speed] kp [kp] kd [kd]",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        kp: { type: "number", defaultValue: "8" },
                        kd: { type: "number", defaultValue: "3" },
                    },
                },
                {
                    opcode: "block_mcLineT5Xc3PaVm",
                    blockType: "command",
                    text: "巡线 速度 [speed] kp [kp] kd [kd] 持续 [sec] 秒",
                    arguments: {
                        speed: { type: "number", defaultValue: "50" },
                        kp: { type: "number", defaultValue: "8" },
                        kd: { type: "number", defaultValue: "3" },
                        sec: { type: "number", defaultValue: "1" },
                    },
                },
                {
                    opcode: "block_mcLineU9Lp4WsBn",
                    blockType: "command",
                    text: "巡线到传感器 [sensor] 速度 [speed] kp [kp] kd [kd] 超时 [timeout] 秒",
                    arguments: {
                        sensor: { type: "string", menu: "menu_mcSensor", defaultValue: "4" },
                        speed: { type: "number", defaultValue: "50" },
                        kp: { type: "number", defaultValue: "8" },
                        kd: { type: "number", defaultValue: "3" },
                        timeout: { type: "number", defaultValue: "3" },
                    },
                },
            ],
            menus: {
                menu_mcMode: "menu_mcMode",
                menu_mcSensor: "menu_mcSensor",
                menu_mcInv: "menu_mcInv",
            },
        };
    }

    menu_mcMode() {
        return [
            { text: "原地逆时针", value: "0" },
            { text: "原地顺时针", value: "1" },
            { text: "直行", value: "2" },
            { text: "侧移", value: "3" },
        ];
    }

    menu_mcSensor() {
        return [
            { text: "S1", value: "1" },
            { text: "S2", value: "2" },
            { text: "S3", value: "3" },
            { text: "S4", value: "4" },
            { text: "S5", value: "5" },
            { text: "S6", value: "6" },
            { text: "S7", value: "7" },
        ];
    }

    menu_mcInv() {
        return [
            { text: "关", value: "0" },
            { text: "开", value: "1" },
        ];
    }

    block_mcInit7Qz2XpKm(args) {}
    block_mcMax3Kd8WnRt(args) {}
    block_mcCali5Fv9LmYb(args) {}
    block_mcDir2Hg7RtQw(args) {}
    block_mcInv6Ys4QbZp(args) {}
    block_mcStop9Nw3KxLu(args) {}
    block_mcAngle1Lj5TaCe(args) {}
    block_mcFwd8Rb2CeMd(args) {}
    block_mcStrafe4Pd7VgNh(args) {}
    block_mcStrafeKt3Wm8DyXj(args) {}
    block_mcTurn6Zq1HsFa(args) {}
    block_mcUntil7Tf4NuKr(args) {}
    block_mcLinePd2Yb9RkQt(args) {}
    block_mcLineT5Xc3PaVm(args) {}
    block_mcLineU9Lp4WsBn(args) {}
}
(function () {
    return {
        MecanumWheelExt26Z: MecanumWheelExt26ZBlock,
    };
})();
