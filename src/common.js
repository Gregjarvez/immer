import {
    finalizeArray as finalizeArrayProxy,
    finalizeObject as finalizeObjectProxy
} from "./proxy"
import {
    finalizeArray as finalizeArrayEs5,
    finalizeObject as finalizeObjectEs5
} from "./es5"

export const PROXY_STATE =
    typeof Symbol !== "undefined"
        ? Symbol("immer-proxy-state")
        : "__$immer_state"
function verifyMinified() {}

let autoFreeze = (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') ||
                 verifyMinified.name === "verifyMinified"
let useProxies = typeof Proxy !== "undefined"

/**
 * Automatically freezes any state trees generated by immer.
 * This protects against accidental modifications of the state tree outside of an immer function.
 * This comes with a performance impact, so it is recommended to disable this option in production.
 * It is by default enabled.
 *
 * @returns {void}
 */
export function setAutoFreeze(enableAutoFreeze) {
    autoFreeze = enableAutoFreeze
}

export function setUseProxies(value) {
    useProxies = value
}

export function getUseProxies() {
    return useProxies
}

export function isProxy(value) {
    return !!value && !!value[PROXY_STATE]
}

export function isProxyable(value) {
    if (!value) return false
    if (typeof value !== "object") return false
    if (Array.isArray(value)) return true
    const proto = Object.getPrototypeOf(value)
    return proto === null || proto === Object.prototype
}

export function freeze(value) {
    if (autoFreeze) {
        Object.freeze(value)
    }
    return value
}

export function shallowCopy(value) {
    return Array.isArray(value) ? value.slice() : Object.assign({}, value) // TODO: eliminate those isArray checks?
}

export function each(value, cb) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) cb(i, value[i])
    } else {
        for (let key in value) cb(key, value[key])
    }
}

// given a base object, returns it if unmodified, or return the changed cloned if modified
export function finalize(base) {
    if (isProxy(base)) {
        const state = base[PROXY_STATE]
        if (state.modified === true) {
            if (state.finalized === true) return state.copy
            state.finalized = true
            if (Array.isArray(state.base))
                return useProxies
                    ? finalizeArrayProxy(state)
                    : finalizeArrayEs5(base, state)
            return useProxies
                ? finalizeObjectProxy(state)
                : finalizeObjectEs5(base, state)
        } else return state.base
    } else if (base !== null && typeof base === "object") {
        finalizeNonProxiedObject(base)
    }
    return base
}

function finalizeNonProxiedObject(parent) {
    // If finalize is called on an object that was not a proxy, it means that it is an object that was not there in the original
    // tree and it could contain proxies at arbitrarily places. Let's find and finalize them as well
    if (!isProxyable(parent)) return
    if (Object.isFrozen(parent)) return
    if (Array.isArray(parent)) {
        for (let i = 0; i < parent.length; i++) {
            const child = parent[i]
            if (isProxy(child)) {
                parent[i] = finalize(child)
            } else finalizeNonProxiedObject(child)
        }
    } else {
        for (let key in parent) {
            const child = parent[key]
            if (isProxy(child)) {
                parent[key] = finalize(child)
            } else finalizeNonProxiedObject(child)
        }
    }
    // always freeze completely new data
    freeze(parent)
}

export function verifyReturnValue(value) {
    // values either than undefined will trigger warning;
    if (value !== undefined)
        console.warn(
            `Immer callback expects no return value. However ${typeof value} was returned`
        )
}
