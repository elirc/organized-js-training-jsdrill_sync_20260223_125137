/* eslint-disable */
/**
 * Drill code sandbox.
 *
 * Runs learner code in a worker so an infinite loop can be killed by
 * terminating the thread — a timeout checked on the main thread after the fact
 * can't do that, because the loop never yields.
 *
 * This is a learning aid, not a security boundary: the worker is same-origin
 * and the code is the user's own. It exists to stop accidental `while (true)`
 * from freezing the tab.
 */

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every(function (v, i) { return deepEqual(v, b[i]); });
  }
  var ka = Object.keys(a).sort();
  var kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every(function (k, i) { return k === kb[i] && deepEqual(a[k], b[k]); });
}

function preview(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "function") return "[Function " + (value.name || "anonymous") + "]";
  if (typeof value === "bigint") return String(value) + "n";
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, function (_k, v) {
      if (typeof v === "function") return "[Function]";
      if (typeof v === "bigint") return String(v) + "n";
      if (v instanceof Map) return { "[Map]": Array.from(v.entries()) };
      if (v instanceof Set) return { "[Set]": Array.from(v.values()) };
      return v;
    });
  } catch (e) {
    return String(value);
  }
}

/** Pull out the name of the last top-level function the learner defined. */
function findEntryPoint(code) {
  var patterns = [
    /function\s+([a-zA-Z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g,
    /class\s+([a-zA-Z_$][\w$]*)/g,
  ];
  var names = [];
  patterns.forEach(function (re) {
    var m;
    while ((m = re.exec(code)) !== null) names.push(m[1]);
  });
  return names.length ? names[0] : null;
}

self.onmessage = function (event) {
  var data = event.data || {};
  var code = data.code || "";
  var testCases = data.testCases || [];
  var entry = data.entryPoint || findEntryPoint(code);
  var logs = [];

  if (!entry) {
    self.postMessage({
      allPassed: false,
      logs: logs,
      errorType: "no-function",
      results: testCases.map(function (tc) {
        return { passed: false, error: "No function found. Define a named function.", testCase: tc };
      }),
    });
    return;
  }

  // Capture console output so "predict the log" style code items can show it.
  var realLog = console.log;
  console.log = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(preview(arguments[i]));
    if (logs.length < 200) logs.push(parts.join(" "));
  };

  var factory;
  try {
    factory = new Function(code + "\n;return " + entry + ";");
  } catch (err) {
    console.log = realLog;
    self.postMessage({
      allPassed: false,
      logs: logs,
      errorType: "syntax-error",
      results: testCases.map(function (tc) {
        return { passed: false, error: "SyntaxError: " + err.message, testCase: tc };
      }),
    });
    return;
  }

  var results = testCases.map(function (tc) {
    try {
      var fn = factory();
      if (typeof fn !== "function") {
        return { passed: false, error: entry + " is not a function.", testCase: tc };
      }
      // A `call` driver lets a test exercise what the function *returns* —
      // a counter object, a memoised wrapper — not just its return value.
      var result = typeof tc.call === "string"
        ? new Function("fn", tc.call)(fn)
        : fn.apply(null, tc.input || []);
      if (result && typeof result.then === "function") {
        return { passed: false, error: "Returned a Promise. These drills expect a synchronous return.", testCase: tc };
      }
      var passed =
        deepEqual(result, tc.expected) ||
        (tc.expected === null && result === undefined) ||
        (tc.expected === undefined && result === null);
      return { passed: passed, result: preview(result), expected: preview(tc.expected), testCase: tc };
    } catch (err) {
      return { passed: false, error: (err && err.name ? err.name + ": " : "") + (err && err.message ? err.message : String(err)), testCase: tc };
    }
  });

  console.log = realLog;

  var failures = results.filter(function (r) { return !r.passed; });
  var errorType = null;
  if (failures.length) {
    if (failures.some(function (r) { return r.error; })) errorType = "runtime-error";
    else if (failures.every(function (r) { return r.testCase.isEdgeCase; })) errorType = "edge-case-miss";
    else if (failures.length === results.length) errorType = "logic-error";
    else errorType = "partial-failure";
  }

  self.postMessage({
    allPassed: failures.length === 0,
    results: results,
    logs: logs,
    errorType: errorType,
  });
};
