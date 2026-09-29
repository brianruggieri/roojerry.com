
export function nurbits_post_to_parent(type) {
    try {
        if (typeof window === "undefined" || window.parent === window || !window.parent) {
            return false;
        }
        window.parent.postMessage({ type: type }, "*");
        return true;
    } catch (e) {
        return false;
    }
}

export function nurbits_document_hidden() {
    try {
        return typeof document !== "undefined" && document.visibilityState === "hidden";
    } catch (e) {
        return false;
    }
}
