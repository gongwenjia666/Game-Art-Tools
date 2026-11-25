/*
 * Spine JSON 4.3 -> 4.2 降级转换（纯前端，无依赖）
 * 逻辑对齐桌面工具 Spine43BatchConverter 的 4.2 中间层处理：
 *   去 null -> 统一 constraints 数组拆回 ik/transform/path -> 皮肤约束引用 ->
 *   drawOrder 首帧补 time=0 -> 输出 4.2 schema
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpineJsonDowngrade = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LEGACY_CONSTRAINT_KEYS = ['ik', 'transform', 'path'];

  function isDict(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function pick(src, keys) {
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      if (hasOwn(src, keys[i])) out[keys[i]] = clone(src[keys[i]]);
    }
    return out;
  }

  /* 递归删除值为 null 的键，返回删除数量 */
  function removeNulls(value) {
    var removed = 0;
    if (isDict(value)) {
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (value[k] === null) {
          delete value[k];
          removed++;
        } else {
          removed += removeNulls(value[k]);
        }
      }
      return removed;
    }
    if (Array.isArray(value)) {
      for (var j = 0; j < value.length; j++) removed += removeNulls(value[j]);
    }
    return removed;
  }

  /* 统计 curve 字段数量，用于降级前后对拍 */
  function curveCount(value) {
    var total = 0;
    if (isDict(value)) {
      if (hasOwn(value, 'curve')) total += 1;
      var keys = Object.keys(value);
      for (var i = 0; i < keys.length; i++) total += curveCount(value[keys[i]]);
      return total;
    }
    if (Array.isArray(value)) {
      for (var j = 0; j < value.length; j++) total += curveCount(value[j]);
    }
    return total;
  }

  function detectSourceVersion(data) {
    var spine = isDict(data) && isDict(data.skeleton) ? data.skeleton.spine : null;
    if (typeof spine === 'string') {
      var m = /^(\d+\.\d+)/.exec(spine);
      if (m) return { version: m[1], full: spine, note: '从 JSON skeleton.spine 读取：' + spine };
    }
    return { version: '', full: '', note: '缺少 skeleton.spine 版本号，按未知版本处理' };
  }

  /* 4.3 的 properties 是否声明了某个属性，声明了即视为默认 100% 混合 */
  function constraintPropertyEnabled(src, names) {
    var properties = src.properties;
    if (!isDict(properties)) return false;
    for (var i = 0; i < names.length; i++) if (hasOwn(properties, names[i])) return true;
    return false;
  }

  /* 取一组轴混合值：显式值优先，其次按 properties 默认 100%，否则未知 */
  function resolve43MixGroup(src, mixKeys, propertyNames) {
    var explicit = [];
    for (var i = 0; i < mixKeys.length; i++) {
      if (hasOwn(src, mixKeys[i])) explicit.push(src[mixKeys[i]]);
    }
    if (explicit.length) {
      var fallback = explicit[0];
      return mixKeys.map(function (k) { return hasOwn(src, k) ? src[k] : fallback; });
    }
    if (constraintPropertyEnabled(src, propertyNames)) {
      return mixKeys.map(function () { return 1; });
    }
    return mixKeys.map(function () { return null; });
  }

  var TRANSFORM_MIX_GROUPS = [
    [['mixRotate'], ['rotate']],
    [['mixX', 'mixY'], ['x', 'y']],
    [['mixScaleX', 'mixScaleY'], ['scaleX', 'scaleY']],
    [['mixShearX', 'mixShearY'], ['shearX', 'shearY']]
  ];

  /* 变换约束：按属性分组还原旧版混合字段 */
  function applyTransformMixes(source, converted, collapseAxes) {
    for (var g = 0; g < TRANSFORM_MIX_GROUPS.length; g++) {
      var mixKeys = TRANSFORM_MIX_GROUPS[g][0];
      var names = TRANSFORM_MIX_GROUPS[g][1];
      var values = resolve43MixGroup(source, mixKeys, names);
      var allNull = true;
      for (var i = 0; i < values.length; i++) if (values[i] !== null) allNull = false;
      if (allNull) continue;
      if (collapseAxes && mixKeys.length === 2) {
        var v = values[1] !== null ? values[1] : values[0];
        converted[mixKeys[0]] = clone(v);
        converted[mixKeys[1]] = clone(v);
      } else {
        for (var j = 0; j < mixKeys.length; j++) {
          if (values[j] !== null) converted[mixKeys[j]] = clone(values[j]);
        }
      }
    }
  }

  /* 路径约束：4.3 的旋转 / 位移混合映射为旧版 mixRotate + mixX/mixY */
  function applyPathMixes(source, converted, collapseAxes) {
    var rotateMix = resolve43MixGroup(source, ['mixRotate'], ['rotate'])[0];
    if (rotateMix !== null) converted.mixRotate = clone(rotateMix);

    var translate = resolve43MixGroup(source, ['mixX', 'mixY'], ['x', 'y']);
    var translateX = translate[0], translateY = translate[1];
    if (translateX !== null || translateY !== null) {
      var translateMix = translateY !== null ? translateY : translateX;
      converted.mixX = clone(collapseAxes ? translateMix : translateX);
      converted.mixY = clone(translateMix);
    }
  }

  /* 单条 4.3 统一约束 -> 旧版按类型分离的对象 */
  function convert43Constraint(source, constraintType, order, collapseAxes) {
    var converted, target, keys;
    if (constraintType === 'ik') {
      keys = ['name', 'bones', 'target', 'mix', 'softness', 'bendPositive', 'compress', 'stretch', 'uniform', 'skin'];
      converted = pick(source, keys);
      if (order) converted.order = order;
      return converted;
    }
    if (constraintType === 'transform') {
      keys = ['name', 'bones', 'local', 'relative', 'rotation', 'x', 'y', 'scaleX', 'scaleY', 'shearY', 'skin'];
      converted = pick(source, keys);
      target = hasOwn(source, 'source') ? source.source : source.target;
      if (target !== undefined && target !== null) converted.target = clone(target);
      applyTransformMixes(source, converted, collapseAxes);
      if (order) converted.order = order;
      return converted;
    }
    keys = ['name', 'bones', 'position', 'spacing', 'rotateMode', 'spacingMode', 'positionMode', 'skin'];
    converted = pick(source, keys);
    target = hasOwn(source, 'target') ? source.target : source.source;
    if (target !== undefined && target !== null) converted.target = clone(target);
    applyPathMixes(source, converted, collapseAxes);
    if (order) converted.order = order;
    return converted;
  }

  function zeroCounts() {
    return { ik: 0, transform: 0, path: 0, physics: 0, unknown: 0, skin: 0 };
  }

  /* 皮肤里的约束引用：字符串引用按名字查类型，对象引用就地转换 */
  function normalize43SkinConstraints(data, constraintTypes, collapseAxes) {
    var skins = data.skins;
    if (!Array.isArray(skins)) return 0;
    var convertedCount = 0;
    for (var s = 0; s < skins.length; s++) {
      var skin = skins[s];
      if (!isDict(skin) || !Array.isArray(skin.constraints)) continue;
      var references = skin.constraints;
      delete skin.constraints;
      var grouped = { ik: [], transform: [], path: [] };
      var unknown = [];
      for (var r = 0; r < references.length; r++) {
        var ref = references[r];
        var type;
        if (typeof ref === 'string') {
          type = constraintTypes[ref];
          if (type && hasOwn(grouped, type)) {
            grouped[type].push(ref);
            convertedCount++;
          } else {
            unknown.push(ref);
          }
        } else if (isDict(ref)) {
          type = ref.type;
          if (type && hasOwn(grouped, type)) {
            grouped[type].push(convert43Constraint(ref, type, 0, collapseAxes));
            convertedCount++;
          } else {
            unknown.push(ref);
          }
        } else {
          unknown.push(ref);
        }
      }
      for (var gk in grouped) {
        if (!hasOwn(grouped, gk)) continue;
        if (!grouped[gk].length) continue;
        if (!Array.isArray(skin[gk])) skin[gk] = [];
        skin[gk] = skin[gk].concat(grouped[gk]);
      }
      if (unknown.length) skin.constraints = unknown;
    }
    return convertedCount;
  }

  /* 动画时间轴里的轴混合折叠，只在目标为 3.x / 4.1 及更早时使用 */
  var ANIMATION_MIX_SPEC = {
    transform: [['mixX', 'mixY'], ['mixScaleX', 'mixScaleY'], ['mixShearX', 'mixShearY']],
    path: [['mixX', 'mixY']]
  };

  function normalize43ConstraintAnimations(data) {
    var animations = data.animations;
    if (!isDict(animations)) return;
    var anims = Object.keys(animations);
    for (var a = 0; a < anims.length; a++) {
      var animation = animations[anims[a]];
      if (!isDict(animation)) continue;
      for (var key in ANIMATION_MIX_SPEC) {
        if (!hasOwn(ANIMATION_MIX_SPEC, key)) continue;
        var timelines = animation[key];
        if (!isDict(timelines)) continue;
        var pairs = ANIMATION_MIX_SPEC[key];
        var names = Object.keys(timelines);
        for (var t = 0; t < names.length; t++) {
          var timeline = timelines[names[t]];
          if (!Array.isArray(timeline)) continue;
          for (var f = 0; f < timeline.length; f++) {
            var frame = timeline[f];
            if (!isDict(frame)) continue;
            for (var p = 0; p < pairs.length; p++) {
              var xKey = pairs[p][0], yKey = pairs[p][1];
              var value = hasOwn(frame, yKey) ? frame[yKey] : frame[xKey];
              if (value === undefined || value === null) continue;
              frame[xKey] = value;
              frame[yKey] = value;
            }
          }
        }
      }
    }
  }

  function normalize43Constraints(data, collapseAxes) {
    var constraints = data.constraints;
    var counts = zeroCounts();
    if (!Array.isArray(constraints)) return counts;

    var grouped = {};
    for (var i = 0; i < LEGACY_CONSTRAINT_KEYS.length; i++) {
      var k = LEGACY_CONSTRAINT_KEYS[i];
      grouped[k] = Array.isArray(data[k]) ? data[k].slice() : [];
    }
    var constraintTypes = {};

    for (var c = 0; c < constraints.length; c++) {
      var item = constraints[c];
      if (!isDict(item)) { counts.unknown++; continue; }
      var type = item.type;
      var name = item.name;
      if (typeof name === 'string' && typeof type === 'string') constraintTypes[name] = type;
      if (typeof type === 'string' && hasOwn(grouped, type)) {
        grouped[type].push(convert43Constraint(item, type, c, collapseAxes));
        counts[type]++;
      } else if (type === 'physics') {
        counts.physics++;
      } else {
        counts.unknown++;
      }
    }

    delete data.constraints;
    for (var g = 0; g < LEGACY_CONSTRAINT_KEYS.length; g++) {
      var key = LEGACY_CONSTRAINT_KEYS[g];
      if (grouped[key].length) data[key] = grouped[key];
    }

    counts.skin = normalize43SkinConstraints(data, constraintTypes, collapseAxes);
    if (collapseAxes) normalize43ConstraintAnimations(data);
    return counts;
  }

  /* 3.7 起 drawOrder 首帧必须有 time，4.2 也保持显式 */
  function normalizeDrawOrderTimestamps(data) {
    var animations = data.animations;
    if (!isDict(animations)) return 0;
    var fixed = 0;
    var anims = Object.keys(animations);
    for (var a = 0; a < anims.length; a++) {
      var animation = animations[anims[a]];
      if (!isDict(animation)) continue;
      var drawOrder = animation.drawOrder;
      if (!Array.isArray(drawOrder) || !drawOrder.length) continue;
      var first = drawOrder[0];
      if (!isDict(first)) continue;
      if (hasOwn(first, 'time')) continue;
      first.time = 0;
      fixed++;
    }
    return fixed;
  }

  /* 4.3 独有、无法映射到 4.2 的内容，列出清单用于提示 */
  var KNOWN_ANIMATION_KEYS = {
    bones: 1, slots: 1, ik: 1, transform: 1, path: 1, deform: 1, drawOrder: 1, events: 1,
    attachments: 1, attachment: 1, rgb: 1, rgb2: 1, rgba: 1, rgba2: 1, alpha: 1, shear: 1,
    scale: 1, rotate: 1, translate: 1, physics: 1, sequence: 1, clip: 1, inherit: 1, slider: 1
  };

  function inspectUnsupported(data) {
    var out = { sliders: [], physicsNames: [], otherNames: [], animationKeys: {}, extras: [] };
    if (Array.isArray(data.constraints)) {
      for (var i = 0; i < data.constraints.length; i++) {
        var item = data.constraints[i];
        if (!isDict(item)) continue;
        if (item.type === 'slider') out.sliders.push(item.name || ('#' + i));
        else if (item.type === 'physics') out.physicsNames.push(item.name || ('#' + i));
        else if (LEGACY_CONSTRAINT_KEYS.indexOf(item.type) < 0 && item.type !== 'physics') {
          out.otherNames.push((item.type || '?') + ':' + (item.name || '#' + i));
        }
      }
    }
    if (isDict(data.animations)) {
      var animNames = Object.keys(data.animations);
      for (var a = 0; a < animNames.length; a++) {
        var anim = data.animations[animNames[a]];
        if (!isDict(anim)) continue;
        var keys = Object.keys(anim);
        for (var k = 0; k < keys.length; k++) {
          if (!hasOwn(KNOWN_ANIMATION_KEYS, keys[k])) {
            if (!out.animationKeys[keys[k]]) out.animationKeys[keys[k]] = [];
            out.animationKeys[keys[k]].push(animNames[a]);
          }
        }
      }
    }
    var linkedCount = 0;
    if (Array.isArray(data.skins)) {
      for (var s = 0; s < data.skins.length; s++) {
        var attachments = data.skins[s] && data.skins[s].attachments;
        if (!isDict(attachments)) continue;
        var slots = Object.keys(attachments);
        for (var i2 = 0; i2 < slots.length; i2++) {
          var slotAtt = attachments[slots[i2]];
          if (!isDict(slotAtt)) continue;
          var attNames = Object.keys(slotAtt);
          for (var j = 0; j < attNames.length; j++) {
            var att = slotAtt[attNames[j]];
            if (!isDict(att)) continue;
            if (hasOwn(att, 'convex') || hasOwn(att, 'inverse')) {
              out.extras.push('裁剪附件 convex/inverse：' + (data.skins[s].name || ('#' + s)) + '/' + slots[i2] + '/' + attNames[j]);
            }
            if (hasOwn(att, 'timelines')) linkedCount++;
          }
        }
      }
    }
    if (linkedCount) out.extras.push('linkedmesh timelines 共 ' + linkedCount + ' 处');
    return out;
  }

  /* 主流程：data 就地修改，返回报告 */
  function convert(data, options) {
    options = options || {};
    var collapseAxes = options.collapseAxes === true;
    var report = {
      sourceVersion: '', targetVersion: '4.2', notes: [], warnings: [],
      curveBefore: curveCount(data), curveAfter: 0, nulls: 0, drawOrderFixed: 0,
      counts: null, converted: false
    };

    var version = detectSourceVersion(data);
    report.sourceVersion = version.full || version.version || '未知';
    report.notes.push(version.note);

    report.nulls = removeNulls(data);
    if (report.nulls) report.notes.push('删除 null 字段 ' + report.nulls + ' 个');

    var unsupported = inspectUnsupported(data);

    if (version.version === '4.3') {
      report.counts = normalize43Constraints(data, collapseAxes);
      data.skeleton.spine = '4.2.11';
      report.converted = true;
      report.notes.push('约束拆分：IK ' + report.counts.ik + ' / 变换 ' + report.counts.transform +
        ' / 路径 ' + report.counts.path + ' / 皮肤引用 ' + report.counts.skin);
      if (report.counts.physics) {
        report.warnings.push('物理约束 ' + report.counts.physics + ' 个未转换（4.3 物理结构无法映射到 4.2）：' + (unsupported.physicsNames.join('、') || '未命名'));
      }
      if (report.counts.unknown) {
        var list = unsupported.sliders.concat(unsupported.otherNames);
        report.warnings.push('不支持的约束 ' + report.counts.unknown + ' 个未写入输出：' + (list.join('、') || '未命名'));
      }
      report.notes.push('skeleton.spine 写为 4.2.11');
    } else if (version.version === '4.2') {
      report.notes.push('输入已是 4.2，只做 null / drawOrder 一致性整理');
    } else {
      report.warnings.push('输入版本 ' + (report.sourceVersion || '未知') + ' 不是 4.3，仅做通用整理，未执行 4.3 结构降级');
    }

    report.drawOrderFixed = normalizeDrawOrderTimestamps(data);
    if (report.drawOrderFixed) report.notes.push('drawOrder 首帧补 time=0：' + report.drawOrderFixed + ' 条');

    if (unsupported.animationKeys['inherit']) {
      report.warnings.push('inherit 时间轴无法映射到 4.2：' + unsupported.animationKeys['inherit'].join('、'));
    }
    for (var extra = 0; extra < unsupported.extras.length; extra++) report.warnings.push(unsupported.extras[extra]);

    report.curveAfter = curveCount(data);
    if (report.curveBefore !== report.curveAfter) {
      report.notes.push('curve 字段数量 ' + report.curveBefore + ' → ' + report.curveAfter);
    }
    return report;
  }

  return {
    convert: convert,
    removeNulls: removeNulls,
    curveCount: curveCount,
    detectSourceVersion: detectSourceVersion,
    convert43Constraint: convert43Constraint,
    normalize43Constraints: normalize43Constraints,
    normalize43SkinConstraints: normalize43SkinConstraints,
    normalize43ConstraintAnimations: normalize43ConstraintAnimations,
    normalizeDrawOrderTimestamps: normalizeDrawOrderTimestamps,
    resolve43MixGroup: resolve43MixGroup
  };
});
