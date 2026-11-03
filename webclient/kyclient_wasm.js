const lAudioContext = (typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : undefined));
let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_6.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_6.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}
/**
 * @returns {Promise<Array<any>>}
 */
export function supportedVideoCodecs() {
    const ret = wasm.supportedVideoCodecs();
    return ret;
}

export function main() {
    wasm.main();
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_2.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}
function __wbg_adapter_34(arg0, arg1) {
    wasm._dyn_core_608f92abc48d28da___ops__function__FnMut_____Output______as_wasm_bindgen_88c81caced527ae4___closure__WasmClosure___describe__invoke______(arg0, arg1);
}

function __wbg_adapter_37(arg0, arg1, arg2) {
    wasm.closure257_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_46(arg0, arg1, arg2) {
    const ret = wasm.closure285_externref_shim_multivalue_shim(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function __wbg_adapter_67(arg0, arg1) {
    const ret = wasm._dyn_core_608f92abc48d28da___ops__function__FnMut_____Output______as_wasm_bindgen_88c81caced527ae4___closure__WasmClosure___describe__invoke___core_608f92abc48d28da___result__Result_____wasm_bindgen_88c81caced527ae4___JsValue___multivalue_shim(arg0, arg1);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function __wbg_adapter_204(arg0, arg1, arg2, arg3) {
    wasm.closure72_externref_shim(arg0, arg1, arg2, arg3);
}

/**
 * @enum {0 | 1 | 2}
 */
export const AudioResumeState = Object.freeze({
    Absent: 0, "0": "Absent",
    Running: 1, "1": "Running",
    Suspended: 2, "2": "Suspended",
});

const __wbindgen_enum_AudioContextState = ["suspended", "running", "closed"];

const __wbindgen_enum_AudioSampleFormat = ["u8", "s16", "s32", "f32", "u8-planar", "s16-planar", "s32-planar", "f32-planar"];

const __wbindgen_enum_BinaryType = ["blob", "arraybuffer"];

const __wbindgen_enum_EncodedAudioChunkType = ["key", "delta"];

const __wbindgen_enum_EncodedVideoChunkType = ["key", "delta"];

const __wbindgen_enum_HardwareAcceleration = ["no-preference", "prefer-hardware", "prefer-software"];

const __wbindgen_enum_ReadableStreamReaderMode = ["byob"];

const __wbindgen_enum_RequestCache = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"];

const __wbindgen_enum_RequestCredentials = ["omit", "same-origin", "include"];

const __wbindgen_enum_RequestMode = ["same-origin", "no-cors", "cors", "navigate"];

const __wbindgen_enum_WebTransportCongestionControl = ["default", "throughput", "low-latency"];

const __wbindgen_enum_WorkerType = ["classic", "module"];

const AuthCredentialsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_authcredentials_free(ptr >>> 0, 1));

export class AuthCredentials {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AuthCredentials.prototype);
        obj.__wbg_ptr = ptr;
        AuthCredentialsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AuthCredentialsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_authcredentials_free(ptr, 0);
    }
    /**
     * @param {string} token
     * @returns {AuthCredentials}
     */
    static jwt(token) {
        const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.authcredentials_jwt(ptr0, len0);
        return AuthCredentials.__wrap(ret);
    }
    /**
     * @param {string} token
     * @returns {AuthCredentials}
     */
    static oidc(token) {
        const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.authcredentials_oidc(ptr0, len0);
        return AuthCredentials.__wrap(ret);
    }
    /**
     * @param {string} username
     * @param {string} password
     * @returns {AuthCredentials}
     */
    static basic(username, password) {
        const ptr0 = passStringToWasm0(username, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.authcredentials_basic(ptr0, len0, ptr1, len1);
        return AuthCredentials.__wrap(ret);
    }
}

const CanvasResizedEventFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_canvasresizedevent_free(ptr >>> 0, 1));

export class CanvasResizedEvent {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(CanvasResizedEvent.prototype);
        obj.__wbg_ptr = ptr;
        CanvasResizedEventFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CanvasResizedEventFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_canvasresizedevent_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_canvasresizedevent_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_canvasresizedevent_width(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_canvasresizedevent_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_canvasresizedevent_height(this.__wbg_ptr, arg0);
    }
}

const ClientFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_client_free(ptr >>> 0, 1));

export class Client {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Client.prototype);
        obj.__wbg_ptr = ptr;
        ClientFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClientFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_client_free(ptr, 0);
    }
    /**
     * @returns {Promise<void>}
     */
    flush_logs() {
        const ret = wasm.client_flush_logs(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} bitrate
     * @returns {Promise<void>}
     */
    set_bitrate(bitrate) {
        const ret = wasm.client_set_bitrate(this.__wbg_ptr, bitrate);
        return ret;
    }
    /**
     * @returns {Promise<void>}
     */
    audio_resume() {
        const ret = wasm.client_audio_resume(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {boolean} mute
     * @returns {Promise<void>}
     */
    audio_set_mute(mute) {
        const ret = wasm.client_audio_set_mute(this.__wbg_ptr, mute);
        return ret;
    }
    /**
     * @returns {Promise<void>}
     */
    stop_streaming() {
        const ret = wasm.client_stop_streaming(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {string} canvas
     * @param {StreamingConfig} config
     * @returns {Promise<void>}
     */
    start_streaming(canvas, config) {
        const ptr0 = passStringToWasm0(canvas, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(config, StreamingConfig);
        var ptr1 = config.__destroy_into_raw();
        const ret = wasm.client_start_streaming(this.__wbg_ptr, ptr0, len0, ptr1);
        return ret;
    }
    /**
     * @param {number} volume
     * @returns {Promise<void>}
     */
    audio_set_volume(volume) {
        const ret = wasm.client_audio_set_volume(this.__wbg_ptr, volume);
        return ret;
    }
    /**
     * @returns {Promise<AudioResumeState>}
     */
    audio_try_resume() {
        const ret = wasm.client_audio_try_resume(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {boolean} stop_session
     * @returns {Promise<void>}
     */
    disconnect_and_stop(stop_session) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.client_disconnect_and_stop(ptr, stop_session);
        return ret;
    }
    /**
     * Create a new Client
     *
     * # Arguments
     *
     * * `host` - The server hostname or IP address to connect to.
     * * `port` - The server port to connect to.
     * * `credentials` - Authentication credentials used to authenticate with the server.
     * * `observer` - A callback function invoked when client events occur, with two arguments
     *   (name, event)
     * * `metrics` - Whether to enable metrics collection.
     * * `metrics_mode_str` - The metrics reporting mode. Accepted values are `"live"`, `"json"`,
     *   or `"both"`.
     * * `live_metrics_callback` - A callback invoked with a live metrics snapshot on each frame,
     *   required when `metrics` is `true`. The callback receives an object with the following
     *   properties:
     *   `"pts"`, `"acquired"`, `"encoding"`, `"encoded"`, `"sent"`, `"received"`, `"decoding"`,
     *   `"decoded"`, `"skipped"`, `"prepared"`, `"displayed"`.
     *   All timestamps are in microseconds (µs). The server timestamps are already compensated
     *   to match the client clock.
     * @param {string} host
     * @param {number} port
     * @param {AuthCredentials} credentials
     * @param {Function} observer
     * @param {boolean} metrics
     * @param {string} metrics_mode_str
     * @param {Function | null | undefined} live_metrics_callback
     * @param {boolean} auto_reconnection
     * @returns {Promise<Client>}
     */
    static new(host, port, credentials, observer, metrics, metrics_mode_str, live_metrics_callback, auto_reconnection) {
        const ptr0 = passStringToWasm0(host, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(credentials, AuthCredentials);
        var ptr1 = credentials.__destroy_into_raw();
        const ptr2 = passStringToWasm0(metrics_mode_str, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.client_new(ptr0, len0, port, ptr1, observer, metrics, ptr2, len2, isLikeNone(live_metrics_callback) ? 0 : addToExternrefTable0(live_metrics_callback), auto_reconnection);
        return ret;
    }
    /**
     * @returns {Promise<void>}
     */
    stop() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.client_stop(ptr);
        return ret;
    }
    disconnect() {
        const ret = wasm.client_disconnect(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    send_ctrl_alt_del() {
        const ret = wasm.client_send_ctrl_alt_del(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {AuthCredentials} credentials
     */
    update_credentials(credentials) {
        _assertClass(credentials, AuthCredentials);
        var ptr0 = credentials.__destroy_into_raw();
        const ret = wasm.client_update_credentials(this.__wbg_ptr, ptr0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    connect() {
        const ret = wasm.client_connect(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {ClientState}
     */
    get_state() {
        const ret = wasm.client_get_state(this.__wbg_ptr);
        return ClientState.__wrap(ret);
    }
}

const ClientStateFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clientstate_free(ptr >>> 0, 1));

export class ClientState {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ClientState.prototype);
        obj.__wbg_ptr = ptr;
        ClientStateFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClientStateFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clientstate_free(ptr, 0);
    }
    /**
     * @returns {number | undefined}
     */
    get volume() {
        const ret = wasm.__wbg_get_clientstate_volume(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @param {number | null} [arg0]
     */
    set volume(arg0) {
        wasm.__wbg_set_clientstate_volume(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : Math.fround(arg0));
    }
    /**
     * @returns {boolean | undefined}
     */
    get mute() {
        const ret = wasm.__wbg_get_clientstate_mute(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set mute(arg0) {
        wasm.__wbg_set_clientstate_mute(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
     * @returns {number | undefined}
     */
    get bitrate() {
        const ret = wasm.__wbg_get_clientstate_bitrate(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @param {number | null} [arg0]
     */
    set bitrate(arg0) {
        wasm.__wbg_set_clientstate_bitrate(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : (arg0) >>> 0);
    }
}

const ClientStoppedFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clientstopped_free(ptr >>> 0, 1));

export class ClientStopped {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ClientStopped.prototype);
        obj.__wbg_ptr = ptr;
        ClientStoppedFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClientStoppedFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clientstopped_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    reason() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.clientstopped_reason(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}

const DisplayListUpdatedEventFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_displaylistupdatedevent_free(ptr >>> 0, 1));

export class DisplayListUpdatedEvent {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DisplayListUpdatedEvent.prototype);
        obj.__wbg_ptr = ptr;
        DisplayListUpdatedEventFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DisplayListUpdatedEventFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_displaylistupdatedevent_free(ptr, 0);
    }
    /**
     * @returns {Array<any>}
     */
    get displays() {
        const ret = wasm.displaylistupdatedevent_displays(this.__wbg_ptr);
        return ret;
    }
}

const GamepadBlocklistEntryFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_gamepadblocklistentry_free(ptr >>> 0, 1));
/**
 * Entry for the gamepad blocklist.
 *
 * Use `new(product, vendor)` to block a specific device.
 * Use `vendor_only(vendor)` to block all devices from a vendor.
 */
export class GamepadBlocklistEntry {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(GamepadBlocklistEntry.prototype);
        obj.__wbg_ptr = ptr;
        GamepadBlocklistEntryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    static __unwrap(jsValue) {
        if (!(jsValue instanceof GamepadBlocklistEntry)) {
            return 0;
        }
        return jsValue.__destroy_into_raw();
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GamepadBlocklistEntryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_gamepadblocklistentry_free(ptr, 0);
    }
    /**
     * Block all gamepads from a specific vendor.
     * Example: `GamepadBlocklistEntry.vendor_only(0x0b0e)`
     * @param {number} vendor
     * @returns {GamepadBlocklistEntry}
     */
    static vendor_only(vendor) {
        const ret = wasm.gamepadblocklistentry_vendor_only(vendor);
        return GamepadBlocklistEntry.__wrap(ret);
    }
    /**
     * Block a specific gamepad by product and vendor ID.
     * Example: `new GamepadBlocklistEntry(0x0b0e, 0x0420)`
     * @param {number} vendor
     * @param {number} product
     */
    constructor(vendor, product) {
        const ret = wasm.gamepadblocklistentry_new(vendor, product);
        this.__wbg_ptr = ret >>> 0;
        GamepadBlocklistEntryFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const StreamingConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamingconfig_free(ptr >>> 0, 1));

export class StreamingConfig {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StreamingConfig.prototype);
        obj.__wbg_ptr = ptr;
        StreamingConfigFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StreamingConfigFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_streamingconfig_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get bitrate() {
        const ret = wasm.__wbg_get_streamingconfig_bitrate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set bitrate(arg0) {
        wasm.__wbg_set_streamingconfig_bitrate(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get display_index() {
        const ret = wasm.__wbg_get_streamingconfig_display_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set display_index(arg0) {
        wasm.__wbg_set_streamingconfig_display_index(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get yuv444() {
        const ret = wasm.__wbg_get_streamingconfig_yuv444(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set yuv444(arg0) {
        wasm.__wbg_set_streamingconfig_yuv444(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get software_decode() {
        const ret = wasm.__wbg_get_streamingconfig_software_decode(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set software_decode(arg0) {
        wasm.__wbg_set_streamingconfig_software_decode(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get audio() {
        const ret = wasm.__wbg_get_streamingconfig_audio(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set audio(arg0) {
        wasm.__wbg_set_streamingconfig_audio(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get inputs() {
        const ret = wasm.__wbg_get_streamingconfig_inputs(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set inputs(arg0) {
        wasm.__wbg_set_streamingconfig_inputs(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean | undefined}
     */
    get intra_refresh() {
        const ret = wasm.__wbg_get_streamingconfig_intra_refresh(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set intra_refresh(arg0) {
        wasm.__wbg_set_streamingconfig_intra_refresh(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
     * @returns {boolean | undefined}
     */
    get gamepad_force_xbox360() {
        const ret = wasm.__wbg_get_streamingconfig_gamepad_force_xbox360(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set gamepad_force_xbox360(arg0) {
        wasm.__wbg_set_streamingconfig_gamepad_force_xbox360(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
     * @returns {number | undefined}
     */
    get audio_buffer() {
        const ret = wasm.__wbg_get_streamingconfig_audio_buffer(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @param {number | null} [arg0]
     */
    set audio_buffer(arg0) {
        wasm.__wbg_set_streamingconfig_audio_buffer(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : (arg0) >>> 0);
    }
    /**
     * @returns {number}
     */
    get video_buffer() {
        const ret = wasm.__wbg_get_streamingconfig_video_buffer(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set video_buffer(arg0) {
        wasm.__wbg_set_streamingconfig_video_buffer(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get notify_video_frame_decoded() {
        const ret = wasm.__wbg_get_streamingconfig_notify_video_frame_decoded(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set notify_video_frame_decoded(arg0) {
        wasm.__wbg_set_streamingconfig_notify_video_frame_decoded(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get clipboard() {
        const ret = wasm.__wbg_get_streamingconfig_clipboard(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set clipboard(arg0) {
        wasm.__wbg_set_streamingconfig_clipboard(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {StreamingConfig}
     */
    clone() {
        const ret = wasm.streamingconfig_clone(this.__wbg_ptr);
        return StreamingConfig.__wrap(ret);
    }
}

const StreamingConfigBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_streamingconfigbuilder_free(ptr >>> 0, 1));

export class StreamingConfigBuilder {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StreamingConfigBuilder.prototype);
        obj.__wbg_ptr = ptr;
        StreamingConfigBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        StreamingConfigBuilderFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_streamingconfigbuilder_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get bitrate() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_bitrate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set bitrate(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_bitrate(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get display_index() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_display_index(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set display_index(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_display_index(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get yuv444() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_yuv444(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set yuv444(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_yuv444(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get software_decode() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_software_decode(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set software_decode(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_software_decode(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get audio() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_audio(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set audio(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_audio(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get inputs() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_inputs(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set inputs(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_inputs(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean | undefined}
     */
    get intra_refresh() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_intra_refresh(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set intra_refresh(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_intra_refresh(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
     * @returns {boolean | undefined}
     */
    get gamepad_force_xbox360() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_gamepad_force_xbox360(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set gamepad_force_xbox360(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_gamepad_force_xbox360(this.__wbg_ptr, isLikeNone(arg0) ? 0xFFFFFF : arg0 ? 1 : 0);
    }
    /**
     * @returns {number | undefined}
     */
    get audio_buffer() {
        const ret = wasm.__wbg_get_streamingconfig_audio_buffer(this.__wbg_ptr);
        return ret === 0x100000001 ? undefined : ret;
    }
    /**
     * @param {number | null} [arg0]
     */
    set audio_buffer(arg0) {
        wasm.__wbg_set_streamingconfig_audio_buffer(this.__wbg_ptr, isLikeNone(arg0) ? 0x100000001 : (arg0) >>> 0);
    }
    /**
     * @returns {number}
     */
    get video_buffer() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_video_buffer(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set video_buffer(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_video_buffer(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get notify_video_frame_decoded() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_notify_video_frame_decoded(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set notify_video_frame_decoded(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_notify_video_frame_decoded(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get clipboard() {
        const ret = wasm.__wbg_get_streamingconfigbuilder_clipboard(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set clipboard(arg0) {
        wasm.__wbg_set_streamingconfigbuilder_clipboard(this.__wbg_ptr, arg0);
    }
    /**
     * @param {string} value
     */
    set protocol(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.streamingconfigbuilder_set_protocol(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} value
     */
    set kymux_audio(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.streamingconfigbuilder_set_kymux_audio(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} value
     */
    set kymux_video(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.streamingconfigbuilder_set_kymux_video(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Set gamepad blocklist from JavaScript array of GamepadBlocklistEntry.
     *
     * Examples:
     * - Block specific device: `new GamepadBlocklistEntry(0x0420, 0x0b0e)`
     * - Block all from vendor: `GamepadBlocklistEntry.vendor_only(0x0b0e)`
     * @param {GamepadBlocklistEntry[]} blocklist
     */
    set_gamepad_blocklist(blocklist) {
        const ptr0 = passArrayJsValueToWasm0(blocklist, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.streamingconfigbuilder_set_gamepad_blocklist(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    constructor() {
        const ret = wasm.streamingconfigbuilder_new();
        this.__wbg_ptr = ret >>> 0;
        StreamingConfigBuilderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {StreamingConfig}
     */
    build() {
        const ret = wasm.streamingconfigbuilder_build(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return StreamingConfig.__wrap(ret[0]);
    }
    /**
     * @returns {StreamingConfigBuilder}
     */
    clone() {
        const ret = wasm.streamingconfigbuilder_clone(this.__wbg_ptr);
        return StreamingConfigBuilder.__wrap(ret);
    }
    /**
     * @param {string} value
     */
    set codec(value) {
        const ptr0 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.streamingconfigbuilder_set_codec(this.__wbg_ptr, ptr0, len0);
    }
}

const VideoRendererWorkerCtxFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_videorendererworkerctx_free(ptr >>> 0, 1));

export class VideoRendererWorkerCtx {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(VideoRendererWorkerCtx.prototype);
        obj.__wbg_ptr = ptr;
        VideoRendererWorkerCtxFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        VideoRendererWorkerCtxFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_videorendererworkerctx_free(ptr, 0);
    }
    /**
     * @param {MessageEvent} event
     */
    on_message(event) {
        const ret = wasm.videorendererworkerctx_on_message(this.__wbg_ptr, event);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {VideoRendererWorkerCtx}
     */
    static new() {
        const ret = wasm.videorendererworkerctx_new();
        return VideoRendererWorkerCtx.__wrap(ret);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_abort_410ec47a64ac6117 = function(arg0, arg1) {
        arg0.abort(arg1);
    };
    imports.wbg.__wbg_abort_775ef1d17fc65868 = function(arg0) {
        arg0.abort();
    };
    imports.wbg.__wbg_abort_fc0ac48651980cb8 = function(arg0) {
        const ret = arg0.abort();
        return ret;
    };
    imports.wbg.__wbg_addEventListener_84ae3eac6e15480a = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3, arg4);
    }, arguments) };
    imports.wbg.__wbg_addEventListener_90e553fdce254421 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3);
    }, arguments) };
    imports.wbg.__wbg_addModule_022af1e4a7300cb3 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.addModule(getStringFromWasm0(arg1, arg2));
        return ret;
    }, arguments) };
    imports.wbg.__wbg_add_177d0470da9b609f = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Atomics.add(arg0, arg1 >>> 0, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_append_8c7dd8d641a5f01b = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        arg0.append(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    }, arguments) };
    imports.wbg.__wbg_arrayBuffer_d1b44c4390db422f = function() { return handleError(function (arg0) {
        const ret = arg0.arrayBuffer();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_arrayBuffer_f18c144cd0125f07 = function(arg0) {
        const ret = arg0.arrayBuffer();
        return ret;
    };
    imports.wbg.__wbg_at_7d852dd9f194d43e = function(arg0, arg1) {
        const ret = arg0.at(arg1);
        return ret;
    };
    imports.wbg.__wbg_audioWorklet_2cd6dd3d1845a632 = function() { return handleError(function (arg0) {
        const ret = arg0.audioWorklet;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_axes_b1da727bd9ea422d = function(arg0) {
        const ret = arg0.axes;
        return ret;
    };
    imports.wbg.__wbg_binaryType_ab5aceac7fbedd31 = function(arg0) {
        const ret = arg0.binaryType;
        return (__wbindgen_enum_BinaryType.indexOf(ret) + 1 || 3) - 1;
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_button_f75c56aec440ea04 = function(arg0) {
        const ret = arg0.button;
        return ret;
    };
    imports.wbg.__wbg_buttons_c4b2b5a0c27f0743 = function(arg0) {
        const ret = arg0.buttons;
        return ret;
    };
    imports.wbg.__wbg_byteLength_e674b853d9c77e1d = function(arg0) {
        const ret = arg0.byteLength;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_833bed5770ea2041 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = arg0.call(arg1, arg2, arg3);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_cancel_81ebaa65c2a54d20 = function(arg0) {
        const ret = arg0.cancel();
        return ret;
    };
    imports.wbg.__wbg_canvasresizedevent_new = function(arg0) {
        const ret = CanvasResizedEvent.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_clearTimeout_7bfb119a4102d492 = function(arg0) {
        const ret = clearTimeout(arg0);
        return ret;
    };
    imports.wbg.__wbg_clearTimeout_8e2cb0120fcfcdb8 = function() { return handleError(function (arg0, arg1) {
        arg0.clearTimeout(arg1);
    }, arguments) };
    imports.wbg.__wbg_clearTimeout_b2651b7485c58446 = function(arg0, arg1) {
        arg0.clearTimeout(arg1);
    };
    imports.wbg.__wbg_clientX_5eb380a5f1fec6fd = function(arg0) {
        const ret = arg0.clientX;
        return ret;
    };
    imports.wbg.__wbg_clientY_d8b9c7f0c4e2e677 = function(arg0) {
        const ret = arg0.clientY;
        return ret;
    };
    imports.wbg.__wbg_client_new = function(arg0) {
        const ret = Client.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_clientstopped_new = function(arg0) {
        const ret = ClientStopped.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_clipboard_93f8aa8cc426db44 = function(arg0) {
        const ret = arg0.clipboard;
        return ret;
    };
    imports.wbg.__wbg_close_162e826d20a642ba = function(arg0) {
        arg0.close();
    };
    imports.wbg.__wbg_close_24caca68e93b9c03 = function(arg0) {
        const ret = arg0.close();
        return ret;
    };
    imports.wbg.__wbg_close_2893b7d056a0627d = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_332d8a0076f48beb = function(arg0, arg1) {
        arg0.close(arg1);
    };
    imports.wbg.__wbg_close_5a97ef05b337f8ce = function() { return handleError(function (arg0) {
        const ret = arg0.close();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_close_c97927f6f9d86747 = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_ec50d58369f2da2d = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_fa50b16598acbea1 = function(arg0) {
        const ret = arg0.close();
        return ret;
    };
    imports.wbg.__wbg_closed_c1a1c77520c65ef1 = function(arg0) {
        const ret = arg0.closed;
        return ret;
    };
    imports.wbg.__wbg_closed_e969addb486e4f10 = function(arg0) {
        const ret = arg0.closed;
        return ret;
    };
    imports.wbg.__wbg_closed_efe2eab65ced237b = function(arg0) {
        const ret = arg0.closed;
        return ret;
    };
    imports.wbg.__wbg_code_459c120478e1ab6e = function(arg0, arg1) {
        const ret = arg1.code;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_code_f4ec1e6e2e1b0417 = function(arg0) {
        const ret = arg0.code;
        return ret;
    };
    imports.wbg.__wbg_codedHeight_68cd784ecbc3b742 = function(arg0) {
        const ret = arg0.codedHeight;
        return ret;
    };
    imports.wbg.__wbg_codedWidth_756904fbc3fc7465 = function(arg0) {
        const ret = arg0.codedWidth;
        return ret;
    };
    imports.wbg.__wbg_compareExchange_04ba2cc47d66e5c3 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = Atomics.compareExchange(arg0, arg1 >>> 0, arg2, arg3);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_configure_69aea2f2c91d2049 = function() { return handleError(function (arg0, arg1) {
        arg0.configure(arg1);
    }, arguments) };
    imports.wbg.__wbg_configure_7eb165dd65fb2b8c = function() { return handleError(function (arg0, arg1) {
        arg0.configure(arg1);
    }, arguments) };
    imports.wbg.__wbg_connect_b22945d106632a36 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.connect(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_copyTo_c4cb4df419161ec2 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        arg0.copyTo(getArrayU8FromWasm0(arg1, arg2), arg3);
    }, arguments) };
    imports.wbg.__wbg_createBidirectionalStream_1864e38d99fe2f41 = function(arg0) {
        const ret = arg0.createBidirectionalStream();
        return ret;
    };
    imports.wbg.__wbg_createGain_3f9db7a6e248669f = function() { return handleError(function (arg0) {
        const ret = arg0.createGain();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_createObjectURL_6e98d2f9c7bd9764 = function() { return handleError(function (arg0, arg1) {
        const ret = URL.createObjectURL(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    }, arguments) };
    imports.wbg.__wbg_createUnidirectionalStream_ec8004ca7d0df7c1 = function(arg0) {
        const ret = arg0.createUnidirectionalStream();
        return ret;
    };
    imports.wbg.__wbg_createWritable_0a880309b433d1c7 = function(arg0) {
        const ret = arg0.createWritable();
        return ret;
    };
    imports.wbg.__wbg_createWritable_b4ed240dc879905e = function(arg0, arg1) {
        const ret = arg0.createWritable(arg1);
        return ret;
    };
    imports.wbg.__wbg_data_432d9c3df2630942 = function(arg0) {
        const ret = arg0.data;
        return ret;
    };
    imports.wbg.__wbg_datagrams_80404f8c7ecfbd83 = function(arg0) {
        const ret = arg0.datagrams;
        return ret;
    };
    imports.wbg.__wbg_debug_3cb59063b29f58c1 = function(arg0) {
        console.debug(arg0);
    };
    imports.wbg.__wbg_decode_6c36f113295ffd87 = function() { return handleError(function (arg0, arg1) {
        arg0.decode(arg1);
    }, arguments) };
    imports.wbg.__wbg_decode_cbab01fdbfe236a5 = function() { return handleError(function (arg0, arg1) {
        arg0.decode(arg1);
    }, arguments) };
    imports.wbg.__wbg_deleteProperty_96363d4a1d977c97 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.deleteProperty(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_deltaMode_9bfd9fe3f6b4b240 = function(arg0) {
        const ret = arg0.deltaMode;
        return ret;
    };
    imports.wbg.__wbg_deltaX_5c1121715746e4b7 = function(arg0) {
        const ret = arg0.deltaX;
        return ret;
    };
    imports.wbg.__wbg_deltaY_f9318542caea0c36 = function(arg0) {
        const ret = arg0.deltaY;
        return ret;
    };
    imports.wbg.__wbg_destination_6400091abd6f01b3 = function(arg0) {
        const ret = arg0.destination;
        return ret;
    };
    imports.wbg.__wbg_disconnect_9523eaea9969f225 = function() { return handleError(function (arg0) {
        arg0.disconnect();
    }, arguments) };
    imports.wbg.__wbg_displayHeight_a6ff7964b6182d84 = function(arg0) {
        const ret = arg0.displayHeight;
        return ret;
    };
    imports.wbg.__wbg_displayWidth_d82e7b620f6f4189 = function(arg0) {
        const ret = arg0.displayWidth;
        return ret;
    };
    imports.wbg.__wbg_displaylistupdatedevent_new = function(arg0) {
        const ret = DisplayListUpdatedEvent.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_document_d249400bd7bd996d = function(arg0) {
        const ret = arg0.document;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_done_769e5ede4b31c67b = function(arg0) {
        const ret = arg0.done;
        return ret;
    };
    imports.wbg.__wbg_drawImage_1659ceb7f8957352 = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
        arg0.drawImage(arg1, arg2, arg3, arg4, arg5);
    }, arguments) };
    imports.wbg.__wbg_entries_2a52db465d0421fb = function(arg0) {
        const ret = arg0.entries();
        return ret;
    };
    imports.wbg.__wbg_error_524f506f44df1645 = function(arg0) {
        console.error(arg0);
    };
    imports.wbg.__wbg_error_7534b8e9a36f1ab4 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbg_exchange_c57e37e19ea8be71 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Atomics.exchange(arg0, arg1 >>> 0, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_exitPointerLock_7b6e7252c7133f69 = function(arg0) {
        arg0.exitPointerLock();
    };
    imports.wbg.__wbg_fetch_509096533071c657 = function(arg0, arg1) {
        const ret = arg0.fetch(arg1);
        return ret;
    };
    imports.wbg.__wbg_fetch_deda9dd882c80f3e = function(arg0) {
        const ret = fetch(arg0);
        return ret;
    };
    imports.wbg.__wbg_fill_3311db9cdf18c6c4 = function(arg0, arg1, arg2, arg3) {
        const ret = arg0.fill(arg1, arg2 >>> 0, arg3 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_format_5fb28357190b9605 = function(arg0) {
        const ret = arg0.format;
        return isLikeNone(ret) ? 9 : ((__wbindgen_enum_AudioSampleFormat.indexOf(ret) + 1 || 9) - 1);
    };
    imports.wbg.__wbg_gain_a9e77ad6f0f8f187 = function(arg0) {
        const ret = arg0.gain;
        return ret;
    };
    imports.wbg.__wbg_gamepad_ee27bbd932ce1939 = function(arg0) {
        const ret = arg0.gamepad;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_gamepadblocklistentry_unwrap = function(arg0) {
        const ret = GamepadBlocklistEntry.__unwrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_getBoundingClientRect_9073b0ff7574d76b = function(arg0) {
        const ret = arg0.getBoundingClientRect();
        return ret;
    };
    imports.wbg.__wbg_getContext_f65a0debd1e8f8e8 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    }, arguments) };
    imports.wbg.__wbg_getDirectory_c206b0540c9acc0f = function(arg0) {
        const ret = arg0.getDirectory();
        return ret;
    };
    imports.wbg.__wbg_getElementById_f827f0d6648718a8 = function(arg0, arg1, arg2) {
        const ret = arg0.getElementById(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_getFileHandle_5fb877d1ecc74d52 = function(arg0, arg1, arg2, arg3) {
        const ret = arg0.getFileHandle(getStringFromWasm0(arg1, arg2), arg3);
        return ret;
    };
    imports.wbg.__wbg_getFile_2607bc0123c724e0 = function(arg0) {
        const ret = arg0.getFile();
        return ret;
    };
    imports.wbg.__wbg_getGamepads_1f997cef580c9088 = function() { return handleError(function (arg0) {
        const ret = arg0.getGamepads();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_getReader_57ba0c0b467b48ec = function(arg0, arg1) {
        const ret = arg0.getReader(arg1);
        return ret;
    };
    imports.wbg.__wbg_getReader_be0d36e5873a525b = function(arg0) {
        const ret = arg0.getReader();
        return ret;
    };
    imports.wbg.__wbg_getType_99a09c0f0ff07d43 = function(arg0, arg1, arg2) {
        const ret = arg0.getType(getStringFromWasm0(arg1, arg2));
        return ret;
    };
    imports.wbg.__wbg_getWriter_6ce182d0adc3f96b = function() { return handleError(function (arg0) {
        const ret = arg0.getWriter();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_b9b93047fe3cf45b = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_has_a5ea9117f258a0ec = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.has(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_headers_9cb51cfd2ac780a4 = function(arg0) {
        const ret = arg0.headers;
        return ret;
    };
    imports.wbg.__wbg_height_592a89ec0fb63726 = function(arg0) {
        const ret = arg0.height;
        return ret;
    };
    imports.wbg.__wbg_height_e3c322f23d99ad2f = function(arg0) {
        const ret = arg0.height;
        return ret;
    };
    imports.wbg.__wbg_id_290cc18d62a31d87 = function(arg0, arg1) {
        const ret = arg1.id;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_incomingBidirectionalStreams_67e3e374b519a940 = function(arg0) {
        const ret = arg0.incomingBidirectionalStreams;
        return ret;
    };
    imports.wbg.__wbg_incomingUnidirectionalStreams_0b1b3186de04bf1c = function(arg0) {
        const ret = arg0.incomingUnidirectionalStreams;
        return ret;
    };
    imports.wbg.__wbg_index_ff9a331b48fca2da = function(arg0) {
        const ret = arg0.index;
        return ret;
    };
    imports.wbg.__wbg_info_3daf2e093e091b66 = function(arg0) {
        console.info(arg0);
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_e14585432e3737fc = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Blob_ca721ef3bdab15d1 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Blob;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_ClipboardItem_c3c456f974ca6269 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ClipboardItem;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_DedicatedWorkerGlobalScope_a688e81380e34e02 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof DedicatedWorkerGlobalScope;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_FileSystemDirectoryHandle_0906fc139d75557b = function(arg0) {
        let result;
        try {
            result = arg0 instanceof FileSystemDirectoryHandle;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_FileSystemFileHandle_d3d037cf85ee546c = function(arg0) {
        let result;
        try {
            result = arg0 instanceof FileSystemFileHandle;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_FileSystemWritableFileStream_688130b888b61cda = function(arg0) {
        let result;
        try {
            result = arg0 instanceof FileSystemWritableFileStream;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_File_a4e2256bf71955a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof File;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_GamepadButton_9a90b34f41783d40 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof GamepadButton;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Gamepad_365ec8404255ce00 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Gamepad;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_HtmlCanvasElement_2ea67072a7624ac5 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof HTMLCanvasElement;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_HtmlElement_51378c201250b16c = function(arg0) {
        let result;
        try {
            result = arg0 instanceof HTMLElement;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Object_7f2dcef8f78644a4 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Object;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_OffscreenCanvasRenderingContext2d_a070fdde7ba760a3 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof OffscreenCanvasRenderingContext2D;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_OffscreenCanvas_d55760945f91bf51 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof OffscreenCanvas;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Promise_935168b8f4b49db3 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Promise;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_ReadableStreamByobReader_937f3bd23fb2074c = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ReadableStreamBYOBReader;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_ReadableStreamDefaultReader_056dcea99b3557aa = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ReadableStreamDefaultReader;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_ReadableStream_87eac785b90f3611 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ReadableStream;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Response_f2cc20d9f7dfd644 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Response;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_17156bcf118086a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_VideoFrame_f362406fe1355687 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof VideoFrame;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_WebTransportBidirectionalStream_bfc63deaa1485f8d = function(arg0) {
        let result;
        try {
            result = arg0 instanceof WebTransportBidirectionalStream;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Window_def73ea0955fc569 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Window;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_WritableStream_ba73ec6ef935602f = function(arg0) {
        let result;
        try {
            result = arg0 instanceof WritableStream;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_a1eab7e0d067391b = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbg_isConfigSupported_a736483d8ddb1462 = function(arg0) {
        const ret = VideoDecoder.isConfigSupported(arg0);
        return ret;
    };
    imports.wbg.__wbg_left_e46801720267b66d = function(arg0) {
        const ret = arg0.left;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_e2d2a49132c1b256 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_load_e8d50870e4f7a070 = function() { return handleError(function (arg0, arg1) {
        const ret = Atomics.load(arg0, arg1 >>> 0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_location_350d99456c2f3693 = function(arg0) {
        const ret = arg0.location;
        return ret;
    };
    imports.wbg.__wbg_log_c222819a41e063d3 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbg_maxDatagramSize_e861838eb4d0f57c = function(arg0) {
        const ret = arg0.maxDatagramSize;
        return ret;
    };
    imports.wbg.__wbg_movementX_1aa05f864931369b = function(arg0) {
        const ret = arg0.movementX;
        return ret;
    };
    imports.wbg.__wbg_movementY_8acfedb38a70e624 = function(arg0) {
        const ret = arg0.movementY;
        return ret;
    };
    imports.wbg.__wbg_navigator_1577371c070c8947 = function(arg0) {
        const ret = arg0.navigator;
        return ret;
    };
    imports.wbg.__wbg_new_018dcc2d6c8c2f6a = function() { return handleError(function () {
        const ret = new Headers();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_23a2665fac83c611 = function(arg0, arg1) {
        try {
            var state0 = {a: arg0, b: arg1};
            var cb0 = (arg0, arg1) => {
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_204(a, state0.b, arg0, arg1);
                } finally {
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return ret;
        } finally {
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_new_405e22f390576ce2 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_46b69df93cd7934c = function() { return handleError(function (arg0) {
        const ret = new EncodedAudioChunk(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_49bbf669d24a0662 = function() { return handleError(function (arg0) {
        const ret = new EncodedVideoChunk(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_59a6be6d80c4dcbb = function() { return handleError(function (arg0) {
        const ret = new VideoDecoder(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_8a6f238a6ece86ea = function() {
        const ret = new Error();
        return ret;
    };
    imports.wbg.__wbg_new_92c54fc74574ef55 = function() { return handleError(function (arg0, arg1) {
        const ret = new WebSocket(getStringFromWasm0(arg0, arg1));
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_9bbdf8c996884982 = function() { return handleError(function (arg0) {
        const ret = new AudioDecoder(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_c68d7209be747379 = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_new_c757c17a3a479543 = function(arg0) {
        const ret = new SharedArrayBuffer(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_new_e25e5aab09ff45db = function() { return handleError(function () {
        const ret = new AbortController();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_999332a180064b59 = function(arg0, arg1, arg2) {
        const ret = new Int32Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithcontextoptions_b62c06fed7900366 = function() { return handleError(function (arg0) {
        const ret = new lAudioContext(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithoptions_0419cac3977d7f7f = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = new Worker(getStringFromWasm0(arg0, arg1), arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithoptions_06e9c2c2d1fe042c = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = new WebTransport(getStringFromWasm0(arg0, arg1), arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithoptions_d7ba55c593232d57 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        const ret = new AudioWorkletNode(arg0, getStringFromWasm0(arg1, arg2), arg3);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithrecordfromstrtoblobpromise_53d3e3611a048f1e = function() { return handleError(function (arg0) {
        const ret = new ClipboardItem(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithstrandinit_06c535e0a867c635 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithstrsequenceandoptions_aaff55b467c81b63 = function() { return handleError(function (arg0, arg1) {
        const ret = new Blob(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithu8arraysequenceandoptions_068570c487f69127 = function() { return handleError(function (arg0, arg1) {
        const ret = new Blob(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_next_6574e1a8a62d1055 = function() { return handleError(function (arg0) {
        const ret = arg0.next();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_now_a89d28f053ab8144 = function(arg0) {
        const ret = arg0.now();
        return ret;
    };
    imports.wbg.__wbg_numberOfChannels_d52ecdb6f0bf6675 = function(arg0) {
        const ret = arg0.numberOfChannels;
        return ret;
    };
    imports.wbg.__wbg_numberOfFrames_ae6096d98555c7a2 = function(arg0) {
        const ret = arg0.numberOfFrames;
        return ret;
    };
    imports.wbg.__wbg_of_2eaf5a02d443ef03 = function(arg0) {
        const ret = Array.of(arg0);
        return ret;
    };
    imports.wbg.__wbg_origin_7c5d649acdace3ea = function() { return handleError(function (arg0, arg1) {
        const ret = arg1.origin;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    }, arguments) };
    imports.wbg.__wbg_ownKeys_3930041068756f1f = function() { return handleError(function (arg0) {
        const ret = Reflect.ownKeys(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_pathname_f525fe3ba3d01fcf = function() { return handleError(function (arg0, arg1) {
        const ret = arg1.pathname;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    }, arguments) };
    imports.wbg.__wbg_performance_3fb718ef8ad5a575 = function(arg0) {
        const ret = arg0.performance;
        return ret;
    };
    imports.wbg.__wbg_pointerLockElement_4e5150cbf7338524 = function(arg0) {
        const ret = arg0.pointerLockElement;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_postMessage_83a8d58d3fcb6c13 = function() { return handleError(function (arg0, arg1) {
        arg0.postMessage(arg1);
    }, arguments) };
    imports.wbg.__wbg_postMessage_f961e53b9731ca83 = function() { return handleError(function (arg0, arg1, arg2) {
        arg0.postMessage(arg1, arg2);
    }, arguments) };
    imports.wbg.__wbg_pressed_b3de5f0878ceb06e = function(arg0) {
        const ret = arg0.pressed;
        return ret;
    };
    imports.wbg.__wbg_preventDefault_c2314fd813c02b3c = function(arg0) {
        arg0.preventDefault();
    };
    imports.wbg.__wbg_push_737cfc8c1432c2c6 = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function(arg0) {
        queueMicrotask(arg0);
    };
    imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function(arg0) {
        const ret = arg0.queueMicrotask;
        return ret;
    };
    imports.wbg.__wbg_read_52e3f904f5768a0e = function(arg0, arg1) {
        const ret = arg0.read(arg1);
        return ret;
    };
    imports.wbg.__wbg_read_99bc78c9329f6cfc = function(arg0) {
        const ret = arg0.read();
        return ret;
    };
    imports.wbg.__wbg_read_a2434af1186cb56c = function(arg0) {
        const ret = arg0.read();
        return ret;
    };
    imports.wbg.__wbg_readable_27169433a44cf102 = function(arg0) {
        const ret = arg0.readable;
        return ret;
    };
    imports.wbg.__wbg_readable_3e4ffb2da948911f = function(arg0) {
        const ret = arg0.readable;
        return ret;
    };
    imports.wbg.__wbg_ready_b8a89d043508e00b = function(arg0) {
        const ret = arg0.ready;
        return ret;
    };
    imports.wbg.__wbg_reason_49f1cede8bcf23dd = function(arg0, arg1) {
        const ret = arg1.reason;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_removeEventListener_056dfe8c3d6c58f9 = function() { return handleError(function (arg0, arg1, arg2, arg3) {
        arg0.removeEventListener(getStringFromWasm0(arg1, arg2), arg3);
    }, arguments) };
    imports.wbg.__wbg_repeat_1882aa0d0072c705 = function(arg0) {
        const ret = arg0.repeat;
        return ret;
    };
    imports.wbg.__wbg_requestAnimationFrame_d7fd890aaefc3246 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.requestAnimationFrame(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_resolve_4851785c9c5f573d = function(arg0) {
        const ret = Promise.resolve(arg0);
        return ret;
    };
    imports.wbg.__wbg_restore_1ef50af0835a4649 = function(arg0) {
        arg0.restore();
    };
    imports.wbg.__wbg_resume_35efdc4ffe13bf18 = function() { return handleError(function (arg0) {
        const ret = arg0.resume();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_rotate_579e00a55de12f1e = function() { return handleError(function (arg0, arg1) {
        arg0.rotate(arg1);
    }, arguments) };
    imports.wbg.__wbg_save_5f563096e64939da = function(arg0) {
        arg0.save();
    };
    imports.wbg.__wbg_seek_3f0f8d7591f648d7 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.seek(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_send_0293179ba074ffb4 = function() { return handleError(function (arg0, arg1, arg2) {
        arg0.send(getStringFromWasm0(arg1, arg2));
    }, arguments) };
    imports.wbg.__wbg_send_fc0c204e8a1757f4 = function() { return handleError(function (arg0, arg1, arg2) {
        arg0.send(getArrayU8FromWasm0(arg1, arg2));
    }, arguments) };
    imports.wbg.__wbg_setProperty_f2cf326652b9a713 = function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
        arg0.setProperty(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
    }, arguments) };
    imports.wbg.__wbg_setTimeout_0ee837fe2edf935b = function(arg0, arg1) {
        const ret = setTimeout(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbg_setTimeout_9560d9e8bee09920 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.setTimeout(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_setTimeout_f2fe5af8e3debeb3 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.setTimeout(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_bb8cecf6a62b9f46 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_setalgorithm_28143807b482252f = function(arg0, arg1, arg2) {
        arg0.algorithm = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setbinaryType_92fa1ffd873b327c = function(arg0, arg1) {
        arg0.binaryType = __wbindgen_enum_BinaryType[arg1];
    };
    imports.wbg.__wbg_setbody_5923b78a95eedf29 = function(arg0, arg1) {
        arg0.body = arg1;
    };
    imports.wbg.__wbg_setcache_12f17c3a980650e4 = function(arg0, arg1) {
        arg0.cache = __wbindgen_enum_RequestCache[arg1];
    };
    imports.wbg.__wbg_setclosecode_b3165a1b5f27dfa3 = function(arg0, arg1) {
        arg0.closeCode = arg1 >>> 0;
    };
    imports.wbg.__wbg_setcodec_0b226484cd1ae2cc = function(arg0, arg1, arg2) {
        arg0.codec = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setcodec_4711d15b4dc250aa = function(arg0, arg1, arg2) {
        arg0.codec = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setcongestioncontrol_f82ccb07b06aaf11 = function(arg0, arg1) {
        arg0.congestionControl = __wbindgen_enum_WebTransportCongestionControl[arg1];
    };
    imports.wbg.__wbg_setcreate_139bad94b2874fb5 = function(arg0, arg1) {
        arg0.create = arg1 !== 0;
    };
    imports.wbg.__wbg_setcredentials_c3a22f1cd105a2c6 = function(arg0, arg1) {
        arg0.credentials = __wbindgen_enum_RequestCredentials[arg1];
    };
    imports.wbg.__wbg_setdata_3b07684c10a82850 = function(arg0, arg1) {
        arg0.data = arg1;
    };
    imports.wbg.__wbg_setdata_5aa9939c8f2f7291 = function(arg0, arg1) {
        arg0.data = arg1;
    };
    imports.wbg.__wbg_seterror_4ce8a2ad7ee75507 = function(arg0, arg1) {
        arg0.error = arg1;
    };
    imports.wbg.__wbg_seterror_c870333b3088ab7a = function(arg0, arg1) {
        arg0.error = arg1;
    };
    imports.wbg.__wbg_setformat_c01a52253cabe148 = function(arg0, arg1) {
        arg0.format = __wbindgen_enum_AudioSampleFormat[arg1];
    };
    imports.wbg.__wbg_setframecount_5e42979669090ae7 = function(arg0, arg1) {
        arg0.frameCount = arg1 >>> 0;
    };
    imports.wbg.__wbg_sethardwareacceleration_15f40e3173e2e8b7 = function(arg0, arg1) {
        arg0.hardwareAcceleration = __wbindgen_enum_HardwareAcceleration[arg1];
    };
    imports.wbg.__wbg_setheaders_834c0bdb6a8949ad = function(arg0, arg1) {
        arg0.headers = arg1;
    };
    imports.wbg.__wbg_setheight_433680330c9420c3 = function(arg0, arg1) {
        arg0.height = arg1 >>> 0;
    };
    imports.wbg.__wbg_setkeepexistingdata_ee7c8cb466e9477f = function(arg0, arg1) {
        arg0.keepExistingData = arg1 !== 0;
    };
    imports.wbg.__wbg_setlatencyhint_b7e65ada79efe30f = function(arg0, arg1) {
        arg0.latencyHint = arg1;
    };
    imports.wbg.__wbg_setmethod_3c5280fe5d890842 = function(arg0, arg1, arg2) {
        arg0.method = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setmode_4967d329825f7890 = function(arg0, arg1) {
        arg0.mode = __wbindgen_enum_ReadableStreamReaderMode[arg1];
    };
    imports.wbg.__wbg_setmode_5dc300b865044b65 = function(arg0, arg1) {
        arg0.mode = __wbindgen_enum_RequestMode[arg1];
    };
    imports.wbg.__wbg_setnumberofchannels_de1cc7adabbefeb9 = function(arg0, arg1) {
        arg0.numberOfChannels = arg1 >>> 0;
    };
    imports.wbg.__wbg_setonclose_14fc475a49d488fc = function(arg0, arg1) {
        arg0.onclose = arg1;
    };
    imports.wbg.__wbg_setonerror_8639efe354b947cd = function(arg0, arg1) {
        arg0.onerror = arg1;
    };
    imports.wbg.__wbg_setonmessage_5a885b16bdc6dca6 = function(arg0, arg1) {
        arg0.onmessage = arg1;
    };
    imports.wbg.__wbg_setonmessage_6eccab530a8fb4c7 = function(arg0, arg1) {
        arg0.onmessage = arg1;
    };
    imports.wbg.__wbg_setonopen_2da654e1f39745d5 = function(arg0, arg1) {
        arg0.onopen = arg1;
    };
    imports.wbg.__wbg_setonstatechange_d2e1a77304e68a8e = function(arg0, arg1) {
        arg0.onstatechange = arg1;
    };
    imports.wbg.__wbg_setoptimizeforlatency_0bccf9d26e3e2224 = function(arg0, arg1) {
        arg0.optimizeForLatency = arg1 !== 0;
    };
    imports.wbg.__wbg_setoutput_5e5ac355ad4c58cf = function(arg0, arg1) {
        arg0.output = arg1;
    };
    imports.wbg.__wbg_setoutput_ff9dc597ad64d749 = function(arg0, arg1) {
        arg0.output = arg1;
    };
    imports.wbg.__wbg_setoutputchannelcount_750fb60731aa0b87 = function(arg0, arg1) {
        arg0.outputChannelCount = arg1;
    };
    imports.wbg.__wbg_setpassive_57a5a4c4b00a7c62 = function(arg0, arg1) {
        arg0.passive = arg1 !== 0;
    };
    imports.wbg.__wbg_setplaneindex_31ad4197948586f1 = function(arg0, arg1) {
        arg0.planeIndex = arg1 >>> 0;
    };
    imports.wbg.__wbg_setprocessoroptions_9e6fe3183ad4a09d = function(arg0, arg1) {
        arg0.processorOptions = arg1;
    };
    imports.wbg.__wbg_setreason_325b96d8f413358b = function(arg0, arg1, arg2) {
        arg0.reason = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_setrequireunreliable_ee8121279d319e0c = function(arg0, arg1) {
        arg0.requireUnreliable = arg1 !== 0;
    };
    imports.wbg.__wbg_setsamplerate_8bc3fd769a6db02b = function(arg0, arg1) {
        arg0.sampleRate = arg1;
    };
    imports.wbg.__wbg_setsamplerate_eac9b1089bb3a647 = function(arg0, arg1) {
        arg0.sampleRate = arg1 >>> 0;
    };
    imports.wbg.__wbg_setservercertificatehashes_417cc2aed3b22969 = function(arg0, arg1) {
        arg0.serverCertificateHashes = arg1;
    };
    imports.wbg.__wbg_setsignal_75b21ef3a81de905 = function(arg0, arg1) {
        arg0.signal = arg1;
    };
    imports.wbg.__wbg_settimestamp_8714d91e6fd59c5b = function(arg0, arg1) {
        arg0.timestamp = arg1;
    };
    imports.wbg.__wbg_settimestamp_fea9915c542831dc = function(arg0, arg1) {
        arg0.timestamp = arg1;
    };
    imports.wbg.__wbg_settype_39ed370d3edd403c = function(arg0, arg1, arg2) {
        arg0.type = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_settype_47fae7d6c82625e7 = function(arg0, arg1) {
        arg0.type = __wbindgen_enum_WorkerType[arg1];
    };
    imports.wbg.__wbg_settype_4982e42c05ec7507 = function(arg0, arg1) {
        arg0.type = __wbindgen_enum_EncodedVideoChunkType[arg1];
    };
    imports.wbg.__wbg_settype_79683f6a8421652d = function(arg0, arg1) {
        arg0.type = __wbindgen_enum_EncodedAudioChunkType[arg1];
    };
    imports.wbg.__wbg_setvalue_6e2359a688310f7f = function(arg0, arg1) {
        arg0.value = arg1;
    };
    imports.wbg.__wbg_setvalue_edd989080f2227df = function(arg0, arg1) {
        arg0.value = arg1;
    };
    imports.wbg.__wbg_setwidth_660ca581e3fbe279 = function(arg0, arg1) {
        arg0.width = arg1 >>> 0;
    };
    imports.wbg.__wbg_signal_aaf9ad74119f20a4 = function(arg0) {
        const ret = arg0.signal;
        return ret;
    };
    imports.wbg.__wbg_size_3808d41635a9c259 = function(arg0) {
        const ret = arg0.size;
        return ret;
    };
    imports.wbg.__wbg_stack_0ed75d68575b0f3c = function(arg0, arg1) {
        const ret = arg1.stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_state_6fd105a4fc591dce = function(arg0) {
        const ret = arg0.state;
        return (__wbindgen_enum_AudioContextState.indexOf(ret) + 1 || 4) - 1;
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_status_f6360336ca686bf0 = function(arg0) {
        const ret = arg0.status;
        return ret;
    };
    imports.wbg.__wbg_storage_89a3fec18b19e1aa = function(arg0) {
        const ret = arg0.storage;
        return ret;
    };
    imports.wbg.__wbg_store_d38d10639308f619 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Atomics.store(arg0, arg1 >>> 0, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_style_fb30c14e5815805c = function(arg0) {
        const ret = arg0.style;
        return ret;
    };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_subarray_b35a92e211d01042 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_suspend_6011a41599f07de4 = function() { return handleError(function (arg0) {
        const ret = arg0.suspend();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_terminate_e8eab2977ce01111 = function(arg0) {
        arg0.terminate();
    };
    imports.wbg.__wbg_then_44b73946d2fb3e7d = function(arg0, arg1) {
        const ret = arg0.then(arg1);
        return ret;
    };
    imports.wbg.__wbg_then_48b406749878a531 = function(arg0, arg1, arg2) {
        const ret = arg0.then(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_timeOrigin_925f11b8378256a0 = function(arg0) {
        const ret = arg0.timeOrigin;
        return ret;
    };
    imports.wbg.__wbg_timestamp_5f0512a1aa9d6d32 = function(arg0, arg1) {
        const ret = arg1.timestamp;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbg_top_ec9fceb1f030f2ea = function(arg0) {
        const ret = arg0.top;
        return ret;
    };
    imports.wbg.__wbg_transferControlToOffscreen_50f0dbdebe8b08e5 = function() { return handleError(function (arg0) {
        const ret = arg0.transferControlToOffscreen();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_translate_e81165546644e0d5 = function() { return handleError(function (arg0, arg1, arg2) {
        arg0.translate(arg1, arg2);
    }, arguments) };
    imports.wbg.__wbg_types_9cf0b8b9a483f20f = function(arg0) {
        const ret = arg0.types;
        return ret;
    };
    imports.wbg.__wbg_url_ae10c34ca209681d = function(arg0, arg1) {
        const ret = arg1.url;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_value_9130fbccd0bd2f87 = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_value_cd1ffa7b1ab794f1 = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_value_f992786d714424bd = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_warn_4ca3906c248c47c4 = function(arg0) {
        console.warn(arg0);
    };
    imports.wbg.__wbg_wasClean_605b4fd66d44354a = function(arg0) {
        const ret = arg0.wasClean;
        return ret;
    };
    imports.wbg.__wbg_width_8fe4e8f77479c2a6 = function(arg0) {
        const ret = arg0.width;
        return ret;
    };
    imports.wbg.__wbg_width_f0759bd8bad335bd = function(arg0) {
        const ret = arg0.width;
        return ret;
    };
    imports.wbg.__wbg_writable_3aaf0c2a3e6b2779 = function(arg0) {
        const ret = arg0.writable;
        return ret;
    };
    imports.wbg.__wbg_writable_f20a11ad767ecbd4 = function(arg0) {
        const ret = arg0.writable;
        return ret;
    };
    imports.wbg.__wbg_write_311434e30ee214e5 = function(arg0, arg1) {
        const ret = arg0.write(arg1);
        return ret;
    };
    imports.wbg.__wbg_write_3e4e8c264c8bf357 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.write(getArrayU8FromWasm0(arg1, arg2));
        return ret;
    }, arguments) };
    imports.wbg.__wbg_write_e357400b06c0ccf5 = function(arg0, arg1) {
        const ret = arg0.write(arg1);
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = arg0.original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1861 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 407, __wbg_adapter_34);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1939 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1944 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1945 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1949 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 284, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1996 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 286, __wbg_adapter_46);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1997 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 286, __wbg_adapter_46);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2022 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 286, __wbg_adapter_46);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2839 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2840 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_34);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2884 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2933 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2935 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper2937 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper3023 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper3478 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_67);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper4730 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 258, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_2;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('kyclient_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
