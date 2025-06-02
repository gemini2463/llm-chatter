"use strict";
//export const WavRenderer = {};
var dataMap = new WeakMap();
/**
 * Normalizes a Float32Array to Array(m): We use this to draw amplitudes on a graph
 * If we're rendering the same audio data, then we'll often be using
 * the same (data, m, downsamplePeaks) triplets so we give option to memoize
 */
var normalizeArray = function (data, m, downsamplePeaks, memoize) {
  if (downsamplePeaks === void 0) {
    downsamplePeaks = false;
  }
  if (memoize === void 0) {
    memoize = false;
  }
  var cache, mKey, dKey;
  if (memoize) {
    mKey = m.toString();
    dKey = downsamplePeaks.toString();
    cache = dataMap.has(data) ? dataMap.get(data) : {};
    dataMap.set(data, cache);
    cache[mKey] = cache[mKey] || {};
    if (cache[mKey][dKey]) {
      return cache[mKey][dKey];
    }
  }
  var n = data.length;
  var result = new Array(m);
  if (m <= n) {
    // Downsampling
    result.fill(0);
    var count = new Array(m).fill(0);
    for (var i = 0; i < n; i++) {
      var index = Math.floor(i * (m / n));
      if (downsamplePeaks) {
        // take highest result in the set
        result[index] = Math.max(result[index], Math.abs(data[i]));
      } else {
        result[index] += Math.abs(data[i]);
      }
      count[index]++;
    }
    if (!downsamplePeaks) {
      for (var i = 0; i < result.length; i++) {
        result[i] = result[i] / count[i];
      }
    }
  } else {
    for (var i = 0; i < m; i++) {
      var index = (i * (n - 1)) / (m - 1);
      var low = Math.floor(index);
      var high = Math.ceil(index);
      var t = index - low;
      if (high >= n) {
        result[i] = data[n - 1];
      } else {
        result[i] = data[low] * (1 - t) + data[high] * t;
      }
    }
  }
  if (memoize) {
    cache[mKey][dKey] = result;
  }
  return result;
};
export const WavRenderer = {
  /**
   * Renders a point-in-time snapshot of an audio sample, usually frequency values
   * @param canvas
   * @param ctx
   * @param data
   * @param color
   * @param pointCount number of bars to render
   * @param barWidth width of bars in px
   * @param barSpacing spacing between bars in px
   * @param center vertically center the bars
   */
  drawBars: function (
    canvas,
    ctx,
    data,
    color,
    pointCount,
    barWidth,
    barSpacing,
    center,
  ) {
    if (pointCount === void 0) {
      pointCount = 0;
    }
    if (barWidth === void 0) {
      barWidth = 0;
    }
    if (barSpacing === void 0) {
      barSpacing = 0;
    }
    if (center === void 0) {
      center = false;
    }
    pointCount = Math.floor(
      Math.min(
        pointCount,
        (canvas.width - barSpacing) / (Math.max(barWidth, 1) + barSpacing),
      ),
    );
    if (!pointCount) {
      pointCount = Math.floor(
        (canvas.width - barSpacing) / (Math.max(barWidth, 1) + barSpacing),
      );
    }
    if (!barWidth) {
      barWidth = (canvas.width - barSpacing) / pointCount - barSpacing;
    }
    var points = normalizeArray(data, pointCount, true);
    for (var i = 0; i < pointCount; i++) {
      var amplitude = Math.abs(points[i]);
      var height = Math.max(1, amplitude * canvas.height);
      var x = barSpacing + i * (barWidth + barSpacing);
      var y = center ? (canvas.height - height) / 2 : canvas.height - height;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, height);
    }
  },
};
