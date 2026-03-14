var RevealPointer = (function () {
  "use strict";

  var keyCodes = {
    backspace: 8,
    tab: 9,
    enter: 13,
    shift: 16,
    ctrl: 17,
    alt: 18,
    pausebreak: 19,
    capslock: 20,
    esc: 27,
    space: 32,
    pageup: 33,
    pagedown: 34,
    end: 35,
    home: 36,
    leftarrow: 37,
    uparrow: 38,
    rightarrow: 39,
    downarrow: 40,
    insert: 45,
    delete: 46,
    0: 48,
    1: 49,
    2: 50,
    3: 51,
    4: 52,
    5: 53,
    6: 54,
    7: 55,
    8: 56,
    9: 57,
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90,
    leftwindowkey: 91,
    rightwindowkey: 92,
    selectkey: 93,
    numpad0: 96,
    numpad1: 97,
    numpad2: 98,
    numpad3: 99,
    numpad4: 100,
    numpad5: 101,
    numpad6: 102,
    numpad7: 103,
    numpad8: 104,
    numpad9: 105,
    multiply: 106,
    add: 107,
    subtract: 109,
    decimalpoint: 110,
    divide: 111,
    f1: 112,
    f2: 113,
    f3: 114,
    f4: 115,
    f5: 116,
    f6: 117,
    f7: 118,
    f8: 119,
    f9: 120,
    f10: 121,
    f11: 122,
    f12: 123,
    numlock: 144,
    scrolllock: 145,
    semicolon: 186,
    equalsign: 187,
    comma: 188,
    dash: 189,
    period: 190,
    forwardslash: 191,
    graveaccent: 192,
    openbracket: 219,
    backslash: 220,
    closebracket: 221,
    singlequote: 222,
  };

  return function () {
    var config = {};
    var pointerEnabled = false;
    var pointerEl = null;
    var trailCanvas = null;
    var trailCtx = null;
    var frameHandle = null;
    var trailPoints = [];

    var pointerState = {
      x: 0,
      y: 0,
      clientX: 0,
      clientY: 0,
      isVisible: false,
      hasPosition: false,
    };

    var revealTransform = {
      x: 0,
      y: 0,
      scale: 1,
    };

    var translateRe = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;
    var scaleRe = /scale\(([-\d.]+)\)/;

    function parseConfig(pluginConfig) {
      var code;
      config = pluginConfig.pointer || {};

      if (config.key == null || typeof config.key !== "string") {
        config.key = "q";
      } else {
        config.key = config.key.toLowerCase();
      }

      if (typeof config.pointerSize !== "number") {
        config.pointerSize = 12;
      }

      if (typeof config.color !== "string") {
        config.color = "red";
      }

      if (typeof config.alwaysVisible !== "boolean") {
        config.alwaysVisible = false;
      }

      if (typeof config.trail !== "boolean") {
        config.trail = false;
      }

      if (
        typeof config.trailDuration !== "number" ||
        !isFinite(config.trailDuration)
      ) {
        config.trailDuration = 150;
      }

      if (
        typeof config.trailSampling !== "number" ||
        !isFinite(config.trailSampling)
      ) {
        config.trailSampling = 2;
      }

      if (
        typeof config.trailMaxPoints !== "number" ||
        !isFinite(config.trailMaxPoints)
      ) {
        config.trailMaxPoints = 80;
      }

      config.trailDuration = Math.max(0, config.trailDuration);
      config.trailSampling = Math.max(0, config.trailSampling);
      config.trailMaxPoints = Math.max(2, Math.round(config.trailMaxPoints));
      code = keyCodes[config.key];
      config.keyCode = code;
    }

    function updateRevealTransform() {
      var transform = document.body.style.transform;
      var translateMatch;
      var scaleMatch;

      if (transform && transform !== "") {
        translateMatch = translateRe.exec(transform);
        scaleMatch = scaleRe.exec(transform);

        revealTransform.x = translateMatch
          ? Number.parseFloat(translateMatch[1])
          : 0;
        revealTransform.y = translateMatch
          ? Number.parseFloat(translateMatch[2])
          : 0;
        revealTransform.scale = scaleMatch
          ? Number.parseFloat(scaleMatch[1])
          : 1;
      } else {
        revealTransform.x = 0;
        revealTransform.y = 0;
        revealTransform.scale = 1;
      }
    }

    function renderPointer() {
      var pointerScale =
        revealTransform.scale === 1 ? 1 : 1 / revealTransform.scale;
      pointerEl.style.top =
        String((pointerState.y - revealTransform.y) / revealTransform.scale) +
        "px";
      pointerEl.style.left =
        String((pointerState.x - revealTransform.x) / revealTransform.scale) +
        "px";
      pointerEl.style.opacity = pointerState.isVisible ? "0.8" : "0";
      pointerEl.style.width = String(config.pointerSize * pointerScale) + "px";
      pointerEl.style.height = String(config.pointerSize * pointerScale) + "px";
    }

    function ensureTrailCanvas() {
      if (trailCanvas) {
        return;
      }

      trailCanvas = document.createElement("canvas");
      trailCanvas.className = "pointer-trail";
      trailCanvas.style.opacity = pointerState.isVisible ? "1" : "0";
      document.body.appendChild(trailCanvas);
      trailCtx = trailCanvas.getContext("2d");
      resizeTrailCanvas();
    }

    function resizeTrailCanvas() {
      var dpr;

      if (!trailCanvas || !trailCtx) {
        return;
      }

      dpr = window.devicePixelRatio || 1;
      trailCanvas.width = Math.floor(window.innerWidth * dpr);
      trailCanvas.height = Math.floor(window.innerHeight * dpr);
      trailCanvas.style.width = String(window.innerWidth) + "px";
      trailCanvas.style.height = String(window.innerHeight) + "px";
      trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function pruneTrail(now) {
      var cutoff = now - config.trailDuration;
      var i = 0;

      while (i < trailPoints.length && trailPoints[i].time < cutoff) {
        i += 1;
      }
      if (i > 0) {
        trailPoints.splice(0, i);
      }
    }

    function smoothedPoints(points) {
      var dense = [];
      var i;
      var p0;
      var p1;
      var mx;
      var my;

      if (points.length === 0) {
        return dense;
      }

      dense.push(points[0]);
      for (i = 1; i < points.length; i += 1) {
        p0 = points[i - 1];
        p1 = points[i];
        mx = (p0.x + p1.x) * 0.5;
        my = (p0.y + p1.y) * 0.5;

        dense.push({
          x: mx,
          y: my,
          time: (p0.time + p1.time) * 0.5,
        });
        dense.push(p1);
      }

      return dense;
    }

    function drawTrail(now) {
      var points;
      var pointCount;
      var maxWidth;
      var i;
      var pPrev;
      var pCurr;
      var pNext;
      var lastPoint;
      var age;
      var life;
      var halfWidth;
      var alpha;
      var dx;
      var dy;
      var length;
      var nx;
      var ny;
      var prevX;
      var prevY;
      var nextX;
      var nextY;
      var pointData;
      var prevData;
      var currData;

      if (!config.trail || !trailCtx || !trailCanvas) {
        return;
      }

      trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (
        !pointerState.isVisible ||
        !pointerState.hasPosition ||
        config.trailDuration === 0
      ) {
        trailPoints = [];
        return;
      }

      pruneTrail(now);

      lastPoint = trailPoints.length
        ? trailPoints[trailPoints.length - 1]
        : null;
      if (
        !lastPoint ||
        Math.abs(lastPoint.x - pointerState.clientX) > config.trailSampling ||
        Math.abs(lastPoint.y - pointerState.clientY) > config.trailSampling
      ) {
        trailPoints.push({
          x: pointerState.clientX,
          y: pointerState.clientY,
          time: now,
        });

        if (trailPoints.length > config.trailMaxPoints) {
          trailPoints.splice(0, trailPoints.length - config.trailMaxPoints);
        }
      }

      points = smoothedPoints(trailPoints);
      pointCount = points.length;
      if (pointCount < 2) {
        return;
      }

      maxWidth = Math.max(1, config.pointerSize * 0.75);
      pointData = [];

      for (i = 0; i < pointCount; i += 1) {
        pCurr = points[i];
        pPrev = i > 0 ? points[i - 1] : points[i];
        pNext = i < pointCount - 1 ? points[i + 1] : points[i];

        prevX = pCurr.x - pPrev.x;
        prevY = pCurr.y - pPrev.y;
        nextX = pNext.x - pCurr.x;
        nextY = pNext.y - pCurr.y;

        dx = prevX + nextX;
        dy = prevY + nextY;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
          dx = pNext.x - pPrev.x;
          dy = pNext.y - pPrev.y;
        }

        length = Math.sqrt(dx * dx + dy * dy);
        if (length < 0.001) {
          dx = 1;
          dy = 0;
          length = 1;
        }

        nx = -dy / length;
        ny = dx / length;

        age = now - pCurr.time;
        life = Math.max(0, 1 - age / config.trailDuration);
        halfWidth = Math.max(0.2, maxWidth * life * 0.5);
        alpha = 0.65 * life;

        pointData.push({
          x: pCurr.x,
          y: pCurr.y,
          nx: nx,
          ny: ny,
          halfWidth: halfWidth,
          alpha: alpha,
        });
      }

      trailCtx.fillStyle = config.color;
      for (i = 1; i < pointData.length; i += 1) {
        prevData = pointData[i - 1];
        currData = pointData[i];

        trailCtx.globalAlpha = Math.min(prevData.alpha, currData.alpha);
        trailCtx.beginPath();
        trailCtx.moveTo(
          prevData.x + prevData.nx * prevData.halfWidth,
          prevData.y + prevData.ny * prevData.halfWidth,
        );
        trailCtx.lineTo(
          currData.x + currData.nx * currData.halfWidth,
          currData.y + currData.ny * currData.halfWidth,
        );
        trailCtx.lineTo(
          currData.x - currData.nx * currData.halfWidth,
          currData.y - currData.ny * currData.halfWidth,
        );
        trailCtx.lineTo(
          prevData.x - prevData.nx * prevData.halfWidth,
          prevData.y - prevData.ny * prevData.halfWidth,
        );
        trailCtx.closePath();
        trailCtx.fill();
      }
      trailCtx.globalAlpha = 1;
    }

    function renderFrame(now) {
      renderPointer();
      drawTrail(now || performance.now());
      frameHandle = requestAnimationFrame(renderFrame);
    }

    function stopFrame() {
      if (frameHandle != null) {
        cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
    }

    function onMouseMove(event) {
      pointerState.x = event.pageX;
      pointerState.y = event.pageY;
      pointerState.clientX = event.clientX;
      pointerState.clientY = event.clientY;
      pointerState.hasPosition = true;
      updateRevealTransform();
      renderPointer();
    }

    function onResize() {
      resizeTrailCanvas();
    }

    function setPointerEnabled(nextEnabled) {
      pointerEnabled = nextEnabled;
      pointerState.isVisible = nextEnabled;

      if (pointerEnabled) {
        document.addEventListener("mousemove", onMouseMove);
        window.addEventListener("resize", onResize);
        document.body.classList.add("no-cursor");
        if (config.trail) {
          ensureTrailCanvas();
        }
        if (trailCanvas) {
          trailCanvas.style.opacity = "1";
        }
        if (frameHandle == null) {
          frameHandle = requestAnimationFrame(renderFrame);
        }
      } else {
        document.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
        document.body.classList.remove("no-cursor");
        trailPoints = [];
        if (trailCanvas && trailCtx) {
          trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
          trailCanvas.style.opacity = "0";
        }
        stopFrame();
        renderPointer();
      }
    }

    function togglePointer() {
      setPointerEnabled(!pointerEnabled);
    }

    return {
      id: "pointer",
      init: function (deck) {
        parseConfig(deck.getConfig());

        pointerEl = document.createElement("div");
        pointerEl.className = "cursor-dot";
        pointerEl.style.width = String(config.pointerSize) + "px";
        pointerEl.style.height = String(config.pointerSize) + "px";
        pointerEl.style.backgroundColor = config.color;
        if (config.alwaysVisible) {
          pointerEl.style.opacity = "0.8";
        }
        document.body.appendChild(pointerEl);

        if (config.alwaysVisible) {
          setPointerEnabled(true);
        } else {
          deck.addKeyBinding(
            {
              keyCode: config.keyCode,
              key: config.key,
            },
            function () {
              togglePointer();
            },
          );
        }
      },
    };
  };
})();
