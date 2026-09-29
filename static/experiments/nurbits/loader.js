/* =============================================================================================
 * Nurbits web shell — the loader. WP7.
 *
 * Responsibilities, and where each one is written down:
 *
 *   click-to-load behind a poster ........ D23 / V15, ARCHITECTURE §11.1
 *   pre-gzipped wasm, decompressed here .. D28 §2, COORDINATOR-FINDINGS §4 (as CORRECTED)
 *   progress bar ......................... ARCHITECTURE §11.3
 *   graceful failure, poster stays up .... ARCHITECTURE §11.4
 *   pause on tab hide .................... D-N7 / V17, ARCHITECTURE §11.5
 *   mute, persisted, and nothing else in
 *   localStorage ......................... D-N10 / D-N12 / V16, ARCHITECTURE §11.7
 *   window.__nurbits_ready ............... tools/capture.mjs waits on exactly this
 *
 * ---------------------------------------------------------------------------------------------
 * THE GZIP TRAP. Read this before touching `openWasmStream`.
 *
 * We ship `nurbits_bg.wasm.gz` and inflate it in the page, because deployment is `rsync` to a
 * private static host where neither brotli, nor `gzip_static`, nor even the `application/wasm`
 * MIME type can be assumed. That buys the compressed transfer size on a server with no
 * configuration at all.
 *
 * The trap: `fetch` transparently decodes a response that carries `Content-Encoding: gzip`. A
 * server configured to tag `.gz` files that way — **which is exactly what our own capture server
 * does**, `tools/capture.mjs:209` — hands us raw wasm, and an unconditional
 * `DecompressionStream('gzip')` then inflates wasm bytes and produces garbage. The rule from
 * COORDINATOR-FINDINGS §4 is therefore: inflate **only when the response was not already decoded**.
 *
 * This file applies that rule twice over. It reads `Content-Encoding`, which is the documented
 * signal, and it also sniffs the first four bytes, which is the ground truth — a gzip member
 * starts `1f 8b`, a wasm module starts `00 61 73 6d`. When the two disagree the bytes win and the
 * disagreement is logged, because a header cannot describe a server that gzips the `.gz` file a
 * second time, and that server exists.
 *
 * Both configurations are covered by `../tools/` nothing — they are covered by hand, in a browser,
 * against a server with the header set and one with it unset. Do not change this function without
 * re-running both.
 * ============================================================================================= */

const WASM_GZ = "nurbits_bg.wasm.gz";
const WASM_PLAIN = "nurbits_bg.wasm";
const GLUE = "./nurbits.js";
const MANIFEST = "build-manifest.json";

/** `src/app.rs`'s `MUTE_STORAGE_KEY`. The only key this project is allowed to write (D-N10/D-N12). */
const MUTE_STORAGE_KEY = "nurbits.muted";

const MAGIC_GZIP = [0x1f, 0x8b];
const MAGIC_WASM = [0x00, 0x61, 0x73, 0x6d];

// ---------------------------------------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------------------------------------

const el = {
	stage: document.getElementById("nb-stage"),
	canvas: document.getElementById("nurbits-canvas"),
	poster: document.getElementById("nb-poster"),
	play: document.getElementById("nb-play"),
	playLabel: document.getElementById("nb-play-label"),
	loading: document.getElementById("nb-loading"),
	bar: document.getElementById("nb-bar"),
	barFill: document.getElementById("nb-bar-fill"),
	loadingLabel: document.getElementById("nb-loading-label"),
	error: document.getElementById("nb-error"),
	errorText: document.getElementById("nb-error-text"),
	errorDetail: document.getElementById("nb-error-detail"),
	mute: document.getElementById("nb-mute"),
	size: document.getElementById("nb-size"),
};

const params = new URLSearchParams(location.search);

/**
 * `?state=screenshot` is the fidelity instrument (`tools/capture.mjs`, `src/capture.rs`). It boots
 * without a gesture, because a headless capture has no one to click for it, and it hides every
 * piece of shell chrome so nothing the shell drew can land inside a captured pixel.
 */
const SCREENSHOT_MODE = params.get("state") === "screenshot";
const AUTOSTART = SCREENSHOT_MODE || isTruthy(params.get("autostart"));

function isTruthy(value) {
	return value === "" || value === "1" || value === "true";
}

// ---------------------------------------------------------------------------------------------
// The public surface
//
// `window.__nurbits_ready` is the contract `tools/capture.mjs` polls. `window.__nurbits` is
// everything else, and it is deliberately small: two hooks a later package can take over, and the
// state the shell already had to keep anyway.
// ---------------------------------------------------------------------------------------------

window.__nurbits_ready = false;

const api = {
	/** Filled from `build-manifest.json` when it arrives. */
	build: null,
	/** True once the wasm booted, a frame is on screen and (in screenshot mode) the replay ran. */
	ready: false,
	/** True from the moment `init()` resolves. */
	booted: false,
	/** `null`, or a short machine-readable reason the boot did not happen. */
	failed: null,
	muted: readStoredMute(),
	/** Every `AudioContext` the wasm has opened, in creation order. */
	audioContexts: [],

	/**
	 * Call this from the engine the moment readiness is genuinely known — the first frame
	 * presented with every critical asset resolved, and in `?state=screenshot` the four
	 * `app::SCREENSHOT_PLACEMENTS` applied. Until something does, the shell falls back to a frame
	 * count plus a settle time, which is a heuristic and says so in the console.
	 *
	 * Intended caller: WP6's `src/ui/overlay_bridge.rs`.
	 */
	signalReady() {
		markReady("engine");
	},

	/** Programmatic mute, same path as the button. */
	setMuted(next) {
		setMuted(Boolean(next));
	},

	/**
	 * Optional hooks a later package may install to take these over from the shell.
	 * `onMute(muted)` replaces the gain interposition; `onVisibility(visible)` replaces the
	 * `AudioContext` suspend/resume.
	 */
	onMute: null,
	onVisibility: null,
};

window.__nurbits = api;

// ---------------------------------------------------------------------------------------------
// Mute (D-N10 / V16)
//
// Unity had no mute, because Unity was not embedded in someone's portfolio. The preference is a
// boot-time input to `BootConfig` (`src/app.rs` reads `localStorage` directly), but a toggle that
// only takes effect on reload is not a mute button, so the shell also has to be able to silence a
// running engine.
//
// It does that without a line of Rust, by owning the graph between the engine and the speakers:
// every `AudioContext` the wasm constructs gets a `GainNode`, and connections aimed at that
// context's `destination` are rerouted through it. cpal's web backend connects its output node to
// `ctx.destination` like everything else does, so one interposition covers the whole engine.
//
// Why a gain and not `AudioContext.suspend()`: this game's clock **is** its audio playhead
// (`src/audio/clock.rs`), so suspending the context would not mute the game, it would stop it.
// Muting must leave the transport running. Hiding the tab is the case that should stop it, and
// that one does use `suspend()` — see below.
//
// The one visible compromise: `AudioNode.connect` returns the node it connected to, for chaining,
// and a rerouted call returns the gain rather than `destination`. Nothing in cpal reads it.
// ---------------------------------------------------------------------------------------------

function readStoredMute() {
	try {
		const raw = localStorage.getItem(MUTE_STORAGE_KEY);
		return raw === "1" || raw === "true";
	} catch {
		// Private mode, blocked site data, a sandboxed iframe without allow-same-origin.
		return false;
	}
}

function writeStoredMute(muted) {
	try {
		localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
	} catch {
		/* A preference that cannot be stored is still a preference for this session. */
	}
}

/** Per-context master gain, installed at construction. */
const masterGains = new WeakMap();

function installAudioInterposition() {
	const Native = window.AudioContext || window.webkitAudioContext;
	if (!Native || typeof AudioNode === "undefined") return;

	const nativeConnect = AudioNode.prototype.connect;

	AudioNode.prototype.connect = function connect(destination) {
		const gain = masterGains.get(this.context);
		if (gain && gain !== this && destination === this.context.destination) {
			const rest = Array.prototype.slice.call(arguments, 1);
			return nativeConnect.apply(this, [gain].concat(rest));
		}
		return nativeConnect.apply(this, arguments);
	};

	class NurbitsAudioContext extends Native {
		constructor(...args) {
			super(...args);
			try {
				const gain = this.createGain();
				gain.gain.value = api.muted ? 0 : 1;
				// Direct call: the patched `connect` must not reroute the gain into itself.
				nativeConnect.call(gain, this.destination);
				masterGains.set(this, gain);
			} catch (err) {
				console.warn("[nurbits] could not install the master gain; mute will need a reload.", err);
			}
			api.audioContexts.push(this);
		}
	}

	window.AudioContext = NurbitsAudioContext;
	if (window.webkitAudioContext) window.webkitAudioContext = NurbitsAudioContext;
}

function setMuted(muted) {
	api.muted = muted;
	writeStoredMute(muted);

	el.mute.setAttribute("aria-pressed", String(muted));
	el.mute.setAttribute("aria-label", muted ? "Unmute audio" : "Mute audio");
	el.mute.title = muted ? "Unmute" : "Mute";

	if (typeof api.onMute === "function") {
		api.onMute(muted);
		return;
	}

	for (const ctx of api.audioContexts) {
		const gain = masterGains.get(ctx);
		if (!gain) continue;
		try {
			// A 20 ms ramp instead of a step: a step on a running graph is an audible click.
			const now = ctx.currentTime;
			gain.gain.cancelScheduledValues(now);
			gain.gain.setValueAtTime(gain.gain.value, now);
			gain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.02);
		} catch {
			gain.gain.value = muted ? 0 : 1;
		}
	}
}

// ---------------------------------------------------------------------------------------------
// Tab visibility (D-N7 / V17)
//
// Unity pauses on focus loss and the browser throttles `requestAnimationFrame` to nothing in a
// hidden tab anyway, so without this a visitor who tabs away comes back to a board whose audio ran
// on while its rendering did not. Suspending the context freezes the playhead, and the playhead is
// the clock, so the whole transport freezes with it — which is the intended behaviour, not a
// side effect.
// ---------------------------------------------------------------------------------------------

function installVisibilityHandling() {
	document.addEventListener("visibilitychange", () => {
		const visible = document.visibilityState === "visible";

		if (typeof api.onVisibility === "function") {
			api.onVisibility(visible);
			return;
		}

		for (const ctx of api.audioContexts) {
			try {
				const promise = visible ? ctx.resume() : ctx.suspend();
				// A context the autoplay policy has not released yet rejects `resume()`. That is
				// not an error worth surfacing: the next gesture releases it.
				if (promise && typeof promise.catch === "function") promise.catch(() => {});
			} catch {
				/* closed context */
			}
		}
	});
}

// ---------------------------------------------------------------------------------------------
// Loading UI
// ---------------------------------------------------------------------------------------------

function showLoading(label) {
	el.loading.hidden = false;
	el.loadingLabel.textContent = label;
}

function setProgress(received, total) {
	if (!total) {
		el.bar.classList.add("nb-bar--indeterminate");
		el.bar.removeAttribute("aria-valuenow");
		el.loadingLabel.textContent = `${mib(received)} MB…`;
		return;
	}
	el.bar.classList.remove("nb-bar--indeterminate");
	const pct = Math.max(0, Math.min(100, (received / total) * 100));
	el.barFill.style.width = `${pct.toFixed(1)}%`;
	el.bar.setAttribute("aria-valuenow", pct.toFixed(0));
	el.loadingLabel.textContent = `${mib(received)} / ${mib(total)} MB`;
}

function setStatus(label) {
	el.bar.classList.remove("nb-bar--indeterminate");
	el.barFill.style.width = "100%";
	el.loadingLabel.textContent = label;
}

function mib(bytes) {
	return (bytes / (1024 * 1024)).toFixed(1);
}

function hideLoading() {
	el.loading.hidden = true;
}

/**
 * ARCHITECTURE §11.4: the poster stays. The visitor keeps the screenshot the embed was meant to
 * replace, which is the status quo rather than a broken frame.
 */
function fail(kind, message, detail) {
	api.failed = kind;
	hideLoading();
	el.stage.classList.remove("is-booted");
	el.poster.hidden = false;
	el.error.hidden = false;
	el.errorText.textContent = message;
	el.errorDetail.textContent = detail ? String(detail) : "";
	el.play.disabled = false;
	el.playLabel.textContent = "Try again";
	console.error(`[nurbits] boot failed (${kind}):`, detail ?? message);
}

// ---------------------------------------------------------------------------------------------
// The wasm fetch
// ---------------------------------------------------------------------------------------------

/** `build-manifest.json` — written by `build.sh`; absent is fine, it only sharpens the bar. */
async function loadManifest() {
	try {
		const res = await fetch(new URL(MANIFEST, import.meta.url), { credentials: "same-origin" });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

function startsWith(bytes, magic) {
	if (bytes.length < magic.length) return false;
	for (let i = 0; i < magic.length; i++) {
		if (bytes[i] !== magic[i]) return false;
	}
	return true;
}

/**
 * Fetch `url` and return a `ReadableStream` of **raw wasm bytes**, inflating on the way only when
 * the body has not already been inflated for us. See the header of this file.
 *
 * `onProgress(received, total)` is called with the bytes actually pulled off the network and the
 * best available denominator for them:
 *
 *   * we inflate       -> we count compressed bytes, and `Content-Length` describes exactly those;
 *   * already inflated -> we count raw bytes while `Content-Length` may still describe the
 *                         compressed body, so only the manifest's `wasmBytes` is honest;
 *   * plain `.wasm`    -> `Content-Length`, or the manifest.
 */
async function openWasmStream(url, { expectGzip, manifest, onProgress }) {
	const res = await fetch(new URL(url, import.meta.url), { credentials: "same-origin" });
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status} ${res.statusText}`);
	if (!res.body) throw new Error(`${url}: this browser gave no response body to stream`);

	const contentEncoding = (res.headers.get("Content-Encoding") || "").toLowerCase();
	// THE DOCUMENTED SIGNAL (COORDINATOR-FINDINGS §4): a body the transport already decoded.
	const headerSaysDecoded = /\b(gzip|x-gzip|deflate|br|zstd)\b/.test(contentEncoding);

	const reader = res.body.getReader();

	// THE GROUND TRUTH: peek at enough bytes to recognise the container. Kept and re-emitted, so
	// nothing is lost from the stream.
	const head = [];
	let headBytes = 0;
	let exhausted = false;
	while (headBytes < 4 && !exhausted) {
		const chunk = await reader.read();
		if (chunk.done) {
			exhausted = true;
			break;
		}
		head.push(chunk.value);
		headBytes += chunk.value.length;
	}

	const magic = new Uint8Array(4);
	{
		let at = 0;
		for (const chunk of head) {
			for (let i = 0; i < chunk.length && at < 4; i++) magic[at++] = chunk[i];
			if (at >= 4) break;
		}
	}

	const looksGzip = startsWith(magic, MAGIC_GZIP);
	const looksWasm = startsWith(magic, MAGIC_WASM);

	let inflate;
	if (looksGzip) {
		inflate = true;
	} else if (looksWasm) {
		inflate = false;
	} else {
		// Unrecognised (a proxy's error page, a truncated body). Fall back to the header rule and
		// let `WebAssembly.compile` produce the real complaint.
		inflate = expectGzip && !headerSaysDecoded;
	}

	if (expectGzip && (looksGzip || looksWasm) && headerSaysDecoded === looksGzip) {
		console.warn(
			`[nurbits] ${url}: Content-Encoding is "${contentEncoding || "(unset)"}" but the body ` +
			`starts with ${looksGzip ? "gzip" : "wasm"} magic. Trusting the bytes and ` +
			`${inflate ? "inflating" : "not inflating"}.`
		);
	}

	if (inflate && typeof DecompressionStream !== "function") {
		await reader.cancel().catch(() => {});
		throw new Error(`${url}: body is gzip and this browser has no DecompressionStream`);
	}

	const contentLength = Number(res.headers.get("Content-Length"));
	const declared = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
	let total;
	if (inflate) {
		total = declared || manifest?.gzBytes || 0;
	} else if (expectGzip) {
		total = manifest?.wasmBytes || 0;
	} else {
		total = declared || manifest?.wasmBytes || 0;
	}

	let received = 0;
	const counted = new ReadableStream({
		start(controller) {
			for (const chunk of head) {
				received += chunk.length;
				controller.enqueue(chunk);
			}
			onProgress(received, total);
			if (exhausted) controller.close();
		},
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				controller.close();
				onProgress(received, received || total);
				return;
			}
			received += value.length;
			controller.enqueue(value);
			onProgress(received, total);
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});

	console.info(
		`[nurbits] ${url}: Content-Encoding "${contentEncoding || "(unset)"}", magic ` +
		`${looksGzip ? "gzip" : looksWasm ? "wasm" : "unknown"} -> ` +
		`${inflate ? "DecompressionStream('gzip')" : "no client-side inflate"}`
	);

	return inflate ? counted.pipeThrough(new DecompressionStream("gzip")) : counted;
}

/**
 * Compile `url` into a `WebAssembly.Module`.
 *
 * The synthetic `Response` carries `Content-Type: application/wasm` by construction, which is the
 * whole reason this approach beats letting the host serve the `.wasm` directly: the deploy target
 * is an `rsync`'d static host whose MIME table is not ours, and `instantiateStreaming` refuses
 * anything else.
 */
async function compileFrom(url, options) {
	const stream = await openWasmStream(url, options);
	const response = new Response(stream, { headers: { "Content-Type": "application/wasm" } });

	if (typeof WebAssembly.compileStreaming !== "function") {
		return await WebAssembly.compile(await response.arrayBuffer());
	}

	try {
		return await WebAssembly.compileStreaming(response);
	} catch (err) {
		// The stream is spent, so the retry re-fetches. Rare enough to be worth the round trip and
		// loud enough to be worth knowing about.
		console.warn("[nurbits] compileStreaming failed; retrying buffered.", err);
		const retry = await openWasmStream(url, options);
		const bytes = await new Response(retry).arrayBuffer();
		return await WebAssembly.compile(bytes);
	}
}

async function loadWasmModule(manifest, onProgress) {
	if (typeof DecompressionStream === "function") {
		try {
			return await compileFrom(WASM_GZ, { expectGzip: true, manifest, onProgress });
		} catch (err) {
			console.warn(`[nurbits] ${WASM_GZ} failed; falling back to ${WASM_PLAIN}.`, err);
		}
	} else {
		console.info(`[nurbits] no DecompressionStream here; loading ${WASM_PLAIN} uncompressed.`);
	}
	return await compileFrom(WASM_PLAIN, { expectGzip: false, manifest, onProgress });
}

// ---------------------------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------------------------

function markReady(source) {
	if (api.ready) return;
	api.ready = true;
	window.__nurbits_ready = true;
	window.dispatchEvent(new CustomEvent("nurbits:ready", { detail: { source } }));
	console.info(`[nurbits] ready (${source})`);
}

/**
 * Until something in the engine calls `window.__nurbits.signalReady()`, readiness is inferred:
 * the canvas has a size and N animation frames have gone by since `init()` resolved.
 *
 * `init()` resolving means `main()` ran and `spawn_app` handed winit the loop
 * (`bevy_winit/src/state.rs:1044`), so `Startup` — which is where `?state=screenshot` applies the
 * four `app::SCREENSHOT_PLACEMENTS` — has run before the first frame is presented. Counting frames
 * after that therefore covers the replay too.
 *
 * What it does NOT cover is asynchronous asset loads, which is why screenshot mode waits longer and
 * why `tools/capture.mjs` still adds its own `--settle`. The honest fix is the engine calling
 * `signalReady()`; this is the floor, not the ceiling, and it announces itself as a heuristic.
 *
 * **The deadline is not optional.** Measured while building this: `tools/capture.mjs` in headless
 * Chrome falls back to SwiftShader (no GPU), where a 1920x1080 frame with MSAA 4x takes seconds,
 * and a frame *count* therefore never completes inside the harness's 60 s budget. A flag that can
 * never be set is worse than a heuristic — the harness then captures on its own blind timer and
 * reports the readiness contract as unimplemented. So the watch always resolves: on the frame
 * count when frames are cheap, on the clock when they are not, saying which in the console.
 */
function beginReadyWatch() {
	const startedAt = performance.now();
	const minFrames = SCREENSHOT_MODE ? 8 : 3;
	const minMillis = SCREENSHOT_MODE ? 500 : 0;
	const deadlineMillis = SCREENSHOT_MODE ? 15000 : 5000;
	let frames = 0;

	console.info(
		`[nurbits] no engine readiness signal yet; inferring from ${minFrames} frames` +
		(minMillis ? ` and ${minMillis} ms` : "") +
		`, deadline ${deadlineMillis} ms. ` +
		"An engine that knows better should call window.__nurbits.signalReady()."
	);

	const tick = () => {
		if (api.ready) return;
		frames += 1;
		const elapsed = performance.now() - startedAt;
		const sized = el.canvas.clientWidth > 0 && el.canvas.clientHeight > 0;

		if (sized && frames >= minFrames && elapsed >= minMillis) {
			markReady(`shell heuristic, ${frames} frames in ${Math.round(elapsed)} ms`);
			return;
		}
		if (elapsed >= deadlineMillis) {
			console.warn(
				`[nurbits] readiness deadline: only ${frames} frame(s) in ${Math.round(elapsed)} ms ` +
				"(software rendering, or a very slow device). Signalling ready anyway so a capture " +
				"harness is not left waiting on a flag that can never be set."
			);
			markReady(`deadline after ${frames} frames`);
			return;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	// `requestAnimationFrame` does not fire at all in a background tab, so the deadline needs a
	// timer of its own or a capture in a throttled tab hangs forever.
	setTimeout(() => {
		if (api.ready) return;
		console.warn(
			"[nurbits] readiness deadline reached with no animation frames at all (throttled or " +
			"hidden tab). Signalling ready."
		);
		markReady("deadline, no frames");
	}, deadlineMillis + 250);
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

function hasWebGl2() {
	try {
		if (typeof WebGL2RenderingContext === "undefined") return false;
		const probe = document.createElement("canvas");
		const gl = probe.getContext("webgl2");
		if (!gl) return false;
		// Give the driver its context straight back; the real one is the engine's.
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return true;
	} catch {
		return false;
	}
}

let booting = false;

async function boot() {
	if (booting || api.booted) return;
	booting = true;

	el.error.hidden = true;
	el.play.disabled = true;
	el.playLabel.textContent = "Loading…";
	showLoading("fetching…");

	// The engine is WebGL2 only and always will be: COORDINATOR-FINDINGS §1 measured Chrome
	// selecting the GL backend, and D31 makes that binding. Checking here rather than at page load
	// keeps a scroll-past from costing a GL context.
	if (!hasWebGl2()) {
		fail(
			"webgl2",
			"This browser could not give the page a WebGL2 context, so the board cannot render. The screenshot above is the level as it looks in the original.",
			null
		);
		booting = false;
		return;
	}

	try {
		// Two round trips that do not depend on each other, so both start now.
		const manifestPromise = loadManifest();
		const gluePromise = import(GLUE);
		// The real handling is the `await` several seconds below. This only keeps a glue that fails
		// fast from being reported as an unhandled rejection in the meantime.
		gluePromise.catch(() => {});
		const manifest = await manifestPromise;
		api.build = manifest;

		const module = await loadWasmModule(manifest, setProgress);

		setStatus("starting the engine…");
		const { default: init } = await gluePromise;
		await init({ module_or_path: module });

		api.booted = true;
		el.stage.classList.add("is-booted");
		el.poster.hidden = true;
		hideLoading();
		beginReadyWatch();
		console.info(
			`[nurbits] booted${manifest?.build ? ` (build ${manifest.build})` : ""}. ` +
			"Recreation of one level of Nurbits; not the original."
		);
	} catch (err) {
		fail("wasm", "The game could not start in this browser.", err?.message || err);
	} finally {
		booting = false;
	}
}

// ---------------------------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------------------------

installAudioInterposition();
installVisibilityHandling();

// Say what the click costs, before the click. `build.sh` writes the real figure onto the stage from
// the artifact it just gzipped; an empty attribute (this file served straight out of `web/`) means
// there is no artifact to measure and the line stays silent rather than guessing.
{
	const mb = (el.stage.dataset.downloadMb || "").trim();
	if (mb && el.size) el.size.textContent = ` · one-time download, about ${mb} MB`;
}

// Reflect the stored preference onto the button without re-writing storage we have not been asked
// to change... which `setMuted` would do harmlessly, and does, so the button and the engine agree
// from the first frame.
setMuted(api.muted);

el.mute.addEventListener("click", (event) => {
	event.preventDefault();
	event.stopPropagation();
	setMuted(!api.muted);
});

el.play.addEventListener("click", (event) => {
	event.preventDefault();
	event.stopPropagation();
	boot();
});

el.poster.addEventListener("click", boot);
el.poster.addEventListener("keydown", (event) => {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		boot();
	}
});

if (SCREENSHOT_MODE) {
	el.stage.classList.add("is-capture");
}

// A panic inside the engine arrives as a plain window error. Before boot it belongs on screen;
// after boot the poster is gone and the console is the right place for it.
window.addEventListener("error", (event) => {
	if (api.booted || api.ready) return;
	if (!booting) return;
	fail("runtime", "The game crashed while starting.", event.message);
});

if (AUTOSTART) {
	// No gesture, so an `AudioContext` created here starts suspended. `?state=screenshot` freezes
	// the clock anyway (`src/capture.rs`), and the visual capture is what this mode exists for.
	console.info("[nurbits] autostart (state=screenshot or autostart=1): booting without a gesture.");
	boot();
}
