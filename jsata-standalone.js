(function (window, document) {
	'use strict';

	var JSATA_SELECTORS = {
		province: 'select.jsata-select-province, .jsata-select-province select',
		district: 'select.jsata-select-district, .jsata-select-district select',
		subdistrict: 'select.jsata-select-subdistrict, .jsata-select-subdistrict select',
		postalcode: 'select.jsata-select-postalcode, .jsata-select-postalcode select'
	};

	var LABEL_KEYS = ['nodata', 'province', 'district', 'subdistrict', 'postalcode'];

	var DEFAULT_LANGUAGE_PACKS = {
		th: {
			slug: 'th',
			nameSource: 'th',
			labels: {
				nodata: 'ไม่พบข้อมูล',
				province: 'เลือกจังหวัด',
				district: 'เลือกอำเภอ/เขต',
				subdistrict: 'เลือกตำบล/แขวง',
				postalcode: 'เลือกรหัสไปรษณีย์'
			}
		},
		en: {
			slug: 'en',
			nameSource: 'en',
			labels: {
				nodata: 'No data',
				province: 'Select province',
				district: 'Select district',
				subdistrict: 'Select subdistrict',
				postalcode: 'Select postal code'
			}
		}
	};

	var state = {
		dataKey: '',
		dataPromise: null,
		dataIndex: null,
		instanceCounter: 0,
		eventsBound: false,
		languagePromises: {},
		languagesBySlug: {}
	};

	function normalizeValue(value) {
		if (Array.isArray(value)) {
			return value.length > 0 ? String(value[0]) : '';
		}
		if (value === undefined || value === null) {
			return '';
		}
		return String(value);
	}

	function isPlainObject(value) {
		return !!(value && typeof value === 'object' && !Array.isArray(value));
	}

	function asObject(value) {
		return isPlainObject(value) ? value : {};
	}

	function hasOwnKeys(value) {
		return isPlainObject(value) && Object.keys(value).length > 0;
	}

	function normalizeLangSlug(value) {
		var slug = normalizeValue(value).trim().toLowerCase();
		slug = slug.replace(/_/g, '-').replace(/\s+/g, '-');
		slug = slug.replace(/[^a-z0-9-]/g, '');
		return slug;
	}

	function getConfig() {
		if (!window.jsataConfig || typeof window.jsataConfig !== 'object') {
			window.jsataConfig = {};
		}
		return window.jsataConfig;
	}

	function pathJoin(base, filename) {
		var normalizedBase = normalizeValue(base);
		if (normalizedBase === '') {
			return filename;
		}
		if (normalizedBase.charAt(normalizedBase.length - 1) !== '/') {
			normalizedBase += '/';
		}
		return normalizedBase + filename;
	}

	function extractByPrefix(className, prefix) {
		if (typeof className !== 'string' || className === '') {
			return '';
		}

		var tokens = className.split(/\s+/);
		for (var i = 0; i < tokens.length; i += 1) {
			if (tokens[i].indexOf(prefix) === 0 && tokens[i].length > prefix.length) {
				return tokens[i].slice(prefix.length);
			}
		}
		return '';
	}

	function detectLangFromDOM() {
		var marker = document.querySelector('[class*="jsata-lang-"]');
		if (marker) {
			var classSlug = normalizeLangSlug(extractByPrefix(marker.className || '', 'jsata-lang-'));
			if (classSlug !== '') {
				return classSlug;
			}
		}

		var htmlLang = document.documentElement && document.documentElement.lang ? document.documentElement.lang : '';
		return normalizeLangSlug(htmlLang);
	}

	function slugFromJsonFilePath(pathOrUrl) {
		var value = normalizeValue(pathOrUrl);
		var match = value.match(/(?:^|\/)([^/?#]+)\.json(?:[?#].*)?$/i);
		if (!match) {
			return '';
		}
		return normalizeLangSlug(match[1]);
	}

	function isDomLikeContext(value) {
		if (!value) {
			return false;
		}

		if (typeof NodeList !== 'undefined' && value instanceof NodeList) {
			return true;
		}

		return !!(value.nodeType === 1 || value.nodeType === 9 || typeof value === 'string' || Array.isArray(value));
	}

	function resolveInitArguments(arg1, arg2) {
		var context = document;
		var options = {};

		if (isPlainObject(arg1) && !isDomLikeContext(arg1)) {
			options = Object.assign({}, arg1);
			context = options.context || document;
			delete options.context;
		} else {
			context = arg1 || document;
			options = isPlainObject(arg2) ? Object.assign({}, arg2) : {};
		}

		return {
			context: context,
			options: options
		};
	}

	function contextToElements(context) {
		if (!context) {
			return [document];
		}

		if (window.jQuery && context instanceof window.jQuery) {
			return context.toArray();
		}

		if (typeof context === 'string') {
			return Array.prototype.slice.call(document.querySelectorAll(context));
		}

		if (Array.isArray(context)) {
			return context;
		}

		if (typeof NodeList !== 'undefined' && context instanceof NodeList) {
			return Array.prototype.slice.call(context);
		}

		if (context.nodeType === 1 || context.nodeType === 9) {
			return [context];
		}

		return [document];
	}

	function collectFieldsByType(context, type) {
		var selector = JSATA_SELECTORS[type];
		if (!selector) {
			return [];
		}

		var roots = contextToElements(context);
		var unique = new Set();
		var fields = [];

		roots.forEach(function (root) {
			if (!root) {
				return;
			}

			if (root.nodeType === 1 && root.matches(selector) && !unique.has(root)) {
				unique.add(root);
				fields.push(root);
			}

			if (!root.querySelectorAll) {
				return;
			}

			var found = root.querySelectorAll(selector);
			for (var i = 0; i < found.length; i += 1) {
				var node = found[i];
				if (!unique.has(node)) {
					unique.add(node);
					fields.push(node);
				}
			}
		});

		return fields;
	}

	function getGroup(field) {
		if (!field) {
			return '';
		}

		var own = extractByPrefix(field.className || '', 'jsata-group-');
		if (own !== '') {
			return own;
		}

		var parent = field.parentElement;
		while (parent) {
			var parentGroup = extractByPrefix(parent.className || '', 'jsata-group-');
			if (parentGroup !== '') {
				return parentGroup;
			}
			parent = parent.parentElement;
		}

		return '';
	}

	function uninitializedFields(context, type) {
		return collectFieldsByType(context, type).filter(function (field) {
			return !field.getAttribute('data-jsata-instance');
		});
	}

	function poolByGroup(context, type) {
		var pool = {
			grouped: {},
			ungrouped: []
		};

		uninitializedFields(context, type).forEach(function (field) {
			var group = getGroup(field);
			if (group !== '') {
				if (!pool.grouped[group]) {
					pool.grouped[group] = [];
				}
				pool.grouped[group].push(field);
			} else {
				pool.ungrouped.push(field);
			}
		});

		return pool;
	}

	function takeGrouped(pool, group) {
		if (!pool.grouped[group] || pool.grouped[group].length === 0) {
			return null;
		}
		return pool.grouped[group].shift();
	}

	function takeUngrouped(pool) {
		if (pool.ungrouped.length === 0) {
			return null;
		}
		return pool.ungrouped.shift();
	}

	function discoverSets(context) {
		var groupedProvinces = {};
		var ungroupedProvinces = [];
		var sets = [];

		uninitializedFields(context, 'province').forEach(function (provinceField) {
			var group = getGroup(provinceField);
			if (group !== '') {
				if (!groupedProvinces[group]) {
					groupedProvinces[group] = [];
				}
				groupedProvinces[group].push(provinceField);
			} else {
				ungroupedProvinces.push(provinceField);
			}
		});

		Object.keys(groupedProvinces).forEach(function (group) {
			groupedProvinces[group].forEach(function (provinceField) {
				sets.push({
					mode: 'grouped',
					group: group,
					province: provinceField
				});
			});
		});

		ungroupedProvinces.forEach(function (provinceField) {
			sets.push({
				mode: 'ungrouped',
				group: '',
				province: provinceField
			});
		});

		if (sets.length === 0) {
			return sets;
		}

		var districtPool = poolByGroup(context, 'district');
		var subdistrictPool = poolByGroup(context, 'subdistrict');
		var postalcodePool = poolByGroup(context, 'postalcode');

		sets.forEach(function (set) {
			if (set.mode === 'grouped') {
				set.district = takeGrouped(districtPool, set.group);
				set.subdistrict = takeGrouped(subdistrictPool, set.group);
				set.postalcode = takeGrouped(postalcodePool, set.group);
			} else {
				set.district = takeUngrouped(districtPool);
				set.subdistrict = takeUngrouped(subdistrictPool);
				set.postalcode = takeUngrouped(postalcodePool);
			}
		});

		return sets;
	}

	function clearInstanceMarks(context) {
		['province', 'district', 'subdistrict', 'postalcode'].forEach(function (type) {
			collectFieldsByType(context, type).forEach(function (field) {
				field.removeAttribute('data-jsata-instance');
				field.removeAttribute('data-jsata-field');
				field.removeAttribute('data-jsata-lang');
				field.removeAttribute('data-jsata-name-source');
				field.removeAttribute('data-jsata-initializing');
			});
		});
	}

	function setInitializingFlag(set, isInitializing) {
		var flag = isInitializing ? '1' : '0';
		['province', 'district', 'subdistrict', 'postalcode'].forEach(function (fieldName) {
			var field = set[fieldName];
			if (field) {
				field.setAttribute('data-jsata-initializing', flag);
			}
		});
	}

	function isInitializing(field) {
		return !!(field && field.getAttribute('data-jsata-initializing') === '1');
	}

	function getInitialValue(field) {
		if (!field) {
			return '';
		}
		var dataValue = field.getAttribute('data-jsata-value');
		if (typeof dataValue === 'string') {
			return dataValue;
		}
		return normalizeValue(field.value);
	}

	function applyValue(field, value) {
		if (!field) {
			return '';
		}
		var normalized = normalizeValue(value);
		field.value = normalized;
		if (field.value !== normalized) {
			field.value = '';
		}
		return normalizeValue(field.value);
	}

	function resetField(field) {
		if (!field) {
			return;
		}
		field.innerHTML = '';
		field.disabled = true;
	}

	function guessScriptUrl(fileKeyword) {
		var script = document.currentScript;
		if (!script || !script.src) {
			var scripts = document.getElementsByTagName('script');
			for (var i = scripts.length - 1; i >= 0; i -= 1) {
				var src = scripts[i].getAttribute('src') || '';
				if (src.indexOf(fileKeyword) !== -1) {
					script = scripts[i];
					break;
				}
			}
		}
		return script && script.src ? script.src : '';
	}

	function guessAddressUrl() {
		var scriptUrl = guessScriptUrl('jsata-standalone');
		if (scriptUrl === '') {
			return 'address.json';
		}

		try {
			var url = new URL(scriptUrl, window.location.href);
			var path = url.pathname || '';
			if (/\/lib\/[^/]+$/i.test(path)) {
				url.pathname = path.replace(/\/lib\/[^/]+$/i, '/address.json');
				url.search = '';
				url.hash = '';
				return url.toString();
			}
			return new URL('address.json', url).toString();
		} catch (err) {
			return 'address.json';
		}
	}

	function guessLangBaseUrl() {
		var scriptUrl = guessScriptUrl('jsata-standalone');
		if (scriptUrl === '') {
			return 'lang/';
		}

		try {
			var url = new URL(scriptUrl, window.location.href);
			var path = url.pathname || '';
			if (/\/lib\/[^/]+$/i.test(path)) {
				url.pathname = path.replace(/\/lib\/[^/]+$/i, '/lib/lang/');
				url.search = '';
				url.hash = '';
				return url.toString();
			}

			url.pathname = path.replace(/\/[^/]*$/, '/lang/');
			url.search = '';
			url.hash = '';
			return url.toString();
		} catch (err) {
			return 'lang/';
		}
	}

	function getAddressUrl(options) {
		var cfg = getConfig();
		if (typeof options.addressUrl === 'string' && options.addressUrl !== '') {
			return options.addressUrl;
		}
		if (typeof options.dataUrl === 'string' && options.dataUrl !== '') {
			return options.dataUrl;
		}
		if (typeof cfg.addressUrl === 'string' && cfg.addressUrl !== '') {
			return cfg.addressUrl;
		}
		if (typeof cfg.dataUrl === 'string' && cfg.dataUrl !== '') {
			return cfg.dataUrl;
		}
		return guessAddressUrl();
	}

	function normalizeLabels(input) {
		var output = {};
		var source = asObject(input);
		LABEL_KEYS.forEach(function (key) {
			if (typeof source[key] === 'string' && source[key] !== '') {
				output[key] = source[key];
			}
		});
		return output;
	}

	function cloneLanguagePack(pack) {
		return {
			slug: pack.slug,
			nameSource: pack.nameSource,
			labels: Object.assign({}, pack.labels)
		};
	}

	function defaultPackForSlug(slug) {
		var normalized = normalizeLangSlug(slug);
		if (normalized === 'en' || normalized.indexOf('en-') === 0) {
			return cloneLanguagePack(DEFAULT_LANGUAGE_PACKS.en);
		}
		return cloneLanguagePack(DEFAULT_LANGUAGE_PACKS.th);
	}

	function parseLanguagePayload(payload, fallbackSlug) {
		var source = asObject(payload);
		var slug = normalizeLangSlug(source.slug || fallbackSlug);
		if (slug === '') {
			slug = 'th';
		}

		var basePack = defaultPackForSlug(slug);
		var labels = {};
		if (hasOwnKeys(source.labels)) {
			labels = normalizeLabels(source.labels);
		} else {
			labels = normalizeLabels(source);
		}

		var nameSource = normalizeLangSlug(source.nameSource || source.name_source || source.dataSource || '');
		if (nameSource !== 'th' && nameSource !== 'en') {
			nameSource = basePack.nameSource;
		}

		return {
			slug: slug,
			nameSource: nameSource,
			labels: Object.assign({}, basePack.labels, labels)
		};
	}

	function registerLanguagePack(pack) {
		var normalized = parseLanguagePayload(pack, pack && pack.slug ? pack.slug : 'th');
		state.languagesBySlug[normalized.slug] = normalized;
		return normalized;
	}

	function labelOf(locale, key) {
		var labels = locale && locale.labels ? locale.labels : {};
		if (typeof labels[key] === 'string' && labels[key] !== '') {
			return labels[key];
		}
		return defaultPackForSlug(locale && locale.slug ? locale.slug : 'th').labels[key] || '';
	}

	function langCandidates(preferredSlug) {
		var normalized = normalizeLangSlug(preferredSlug);
		var candidates = [];

		if (normalized !== '') {
			candidates.push(normalized);
			if (normalized.indexOf('-') !== -1) {
				var base = normalized.split('-')[0];
				if (base && candidates.indexOf(base) === -1) {
					candidates.push(base);
				}
			}
		}

		if (candidates.length === 0) {
			candidates.push('th');
		}

		return candidates;
	}

	function detectPreferredLangSlug(options) {
		var cfg = getConfig();
		var byOption = normalizeLangSlug(options.lang || options.language || '');
		if (byOption !== '') {
			return byOption;
		}

		var byConfig = normalizeLangSlug(cfg.lang || cfg.language || '');
		if (byConfig !== '') {
			return byConfig;
		}

		var byDom = detectLangFromDOM();
		if (byDom !== '') {
			return byDom;
		}

		return 'th';
	}

	function resolveLangUrlBySlug(slug, options) {
		var cfg = getConfig();
		var normalizedSlug = normalizeLangSlug(slug);
		var optLangUrls = asObject(options.langUrls);
		var cfgLangUrls = asObject(cfg.langUrls);

		if (typeof optLangUrls[normalizedSlug] === 'string' && optLangUrls[normalizedSlug] !== '') {
			return optLangUrls[normalizedSlug];
		}
		if (typeof cfgLangUrls[normalizedSlug] === 'string' && cfgLangUrls[normalizedSlug] !== '') {
			return cfgLangUrls[normalizedSlug];
		}

		var optTemplate = normalizeValue(options.langUrlTemplate);
		if (optTemplate !== '') {
			return optTemplate.replace('{lang}', normalizedSlug);
		}
		var cfgTemplate = normalizeValue(cfg.langUrlTemplate);
		if (cfgTemplate !== '') {
			return cfgTemplate.replace('{lang}', normalizedSlug);
		}

		var optBase = normalizeValue(options.langBaseUrl);
		if (optBase !== '') {
			return pathJoin(optBase, normalizedSlug + '.json');
		}
		var cfgBase = normalizeValue(cfg.langBaseUrl);
		if (cfgBase !== '') {
			return pathJoin(cfgBase, normalizedSlug + '.json');
		}

		return pathJoin(guessLangBaseUrl(), normalizedSlug + '.json');
	}

	function fetchJson(url) {
		if (typeof window.fetch !== 'function') {
			return Promise.reject(new Error('Fetch API is not supported in this browser.'));
		}

		return window.fetch(url, { credentials: 'same-origin' }).then(function (response) {
			if (!response.ok) {
				throw new Error('Failed to load "' + url + '" (' + response.status + ')');
			}
			return response.json();
		});
	}

	function ensureLanguageLoaded(options) {
		var preferredSlug = detectPreferredLangSlug(options);
		var cfg = getConfig();
		var explicitLangData = asObject(options.langData);
		var configLangData = asObject(cfg.langData);

		if (hasOwnKeys(explicitLangData)) {
			return Promise.resolve(registerLanguagePack(parseLanguagePayload(explicitLangData, preferredSlug)));
		}
		if (hasOwnKeys(configLangData)) {
			return Promise.resolve(registerLanguagePack(parseLanguagePayload(configLangData, preferredSlug)));
		}

		var explicitLangUrl = normalizeValue(options.langUrl || cfg.langUrl);
		if (explicitLangUrl !== '') {
			var explicitSlug = slugFromJsonFilePath(explicitLangUrl) || preferredSlug;
			var explicitKey = 'url:' + explicitLangUrl;
			if (state.languagePromises[explicitKey]) {
				return state.languagePromises[explicitKey];
			}

			state.languagePromises[explicitKey] = fetchJson(explicitLangUrl)
				.then(function (json) {
					return registerLanguagePack(parseLanguagePayload(json, explicitSlug));
				})
				.catch(function () {
					return registerLanguagePack(defaultPackForSlug(explicitSlug));
				})
				.finally(function () {
					delete state.languagePromises[explicitKey];
				});

			return state.languagePromises[explicitKey];
		}

		var candidates = langCandidates(preferredSlug);

		function tryCandidate(index) {
			if (index >= candidates.length) {
				return Promise.resolve(registerLanguagePack(defaultPackForSlug(preferredSlug)));
			}

			var slug = candidates[index];
			if (state.languagesBySlug[slug]) {
				return Promise.resolve(state.languagesBySlug[slug]);
			}

			var url = resolveLangUrlBySlug(slug, options);
			var key = 'url:' + url;

			if (!state.languagePromises[key]) {
				state.languagePromises[key] = fetchJson(url)
					.then(function (json) {
						return registerLanguagePack(parseLanguagePayload(json, slugFromJsonFilePath(url) || slug));
					})
					.finally(function () {
						delete state.languagePromises[key];
					});
			}

			return state.languagePromises[key].catch(function () {
				return tryCandidate(index + 1);
			});
		}

		return tryCandidate(0);
	}

	function isNumericKey(key) {
		return /^[0-9]+$/.test(String(key));
	}

	function compareByNameSource(a, b, nameSource) {
		var source = nameSource === 'en' ? 'en' : 'th';
		var aName = normalizeValue(a && a.names ? a.names[source] : '');
		var bName = normalizeValue(b && b.names ? b.names[source] : '');
		return aName.localeCompare(bName, source === 'th' ? 'th' : 'en');
	}

	function buildAddressIndex(raw) {
		var provinceMap = asObject(raw);
		var provinces = [];
		var districtsByProvince = {};
		var subdistrictsByDistrict = {};
		var postalcodesBySubdistrict = {};

		Object.keys(provinceMap).forEach(function (pvId) {
			if (!isNumericKey(pvId)) {
				return;
			}

			var pvRow = asObject(provinceMap[pvId]);
			provinces.push({
				id: String(pvId),
				names: {
					th: normalizeValue(pvRow.pv_name_th),
					en: normalizeValue(pvRow.pv_name_en)
				}
			});

			var districts = [];
			Object.keys(pvRow).forEach(function (dtId) {
				if (!isNumericKey(dtId)) {
					return;
				}

				var dtRow = asObject(pvRow[dtId]);
				districts.push({
					id: String(dtId),
					pvId: String(pvId),
					names: {
						th: normalizeValue(dtRow.dt_name_th),
						en: normalizeValue(dtRow.dt_name_en)
					}
				});

				var subdistricts = [];
				Object.keys(dtRow).forEach(function (sdtId) {
					if (!isNumericKey(sdtId)) {
						return;
					}

					var sdtRow = asObject(dtRow[sdtId]);
					subdistricts.push({
						id: String(sdtId),
						dtId: String(dtId),
						pvId: String(pvId),
						names: {
							th: normalizeValue(sdtRow.sdt_name_th),
							en: normalizeValue(sdtRow.sdt_name_en)
						}
					});

					var rawPostalcodes = Array.isArray(sdtRow.sdt_postal_code) ? sdtRow.sdt_postal_code : [];
					var seen = {};
					var postalcodes = [];
					rawPostalcodes.forEach(function (code) {
						var normalizedCode = normalizeValue(code);
						if (normalizedCode === '' || seen[normalizedCode]) {
							return;
						}
						seen[normalizedCode] = true;
						postalcodes.push({
							value: normalizedCode,
							label: normalizedCode
						});
					});
					postalcodes.sort(function (a, b) {
						return a.value.localeCompare(b.value, 'th', { numeric: true });
					});

					postalcodesBySubdistrict[String(pvId) + ':' + String(dtId) + ':' + String(sdtId)] = postalcodes;
				});

				subdistrictsByDistrict[String(pvId) + ':' + String(dtId)] = subdistricts;
			});

			districtsByProvince[String(pvId)] = districts;
		});

		return {
			provinces: provinces,
			districtsByProvince: districtsByProvince,
			subdistrictsByDistrict: subdistrictsByDistrict,
			postalcodesBySubdistrict: postalcodesBySubdistrict
		};
	}

	function ensureAddressDataLoaded(options) {
		var cfg = getConfig();
		var inlineData = hasOwnKeys(options.data) ? options.data : (hasOwnKeys(cfg.data) ? cfg.data : null);

		if (inlineData) {
			var inlineKey = 'inline';
			if (state.dataIndex && state.dataKey === inlineKey) {
				return Promise.resolve(state.dataIndex);
			}
			state.dataKey = inlineKey;
			state.dataIndex = buildAddressIndex(inlineData);
			state.dataPromise = null;
			return Promise.resolve(state.dataIndex);
		}

		var dataUrl = getAddressUrl(options);
		var urlKey = 'url:' + dataUrl;

		if (state.dataIndex && state.dataKey === urlKey) {
			return Promise.resolve(state.dataIndex);
		}

		if (state.dataPromise && state.dataKey === urlKey) {
			return state.dataPromise;
		}

		state.dataKey = urlKey;
		state.dataPromise = fetchJson(dataUrl)
			.then(function (json) {
				state.dataIndex = buildAddressIndex(json);
				return state.dataIndex;
			})
			.catch(function (error) {
				console.error('[JSATA] ' + error.message);
				state.dataIndex = {
					provinces: [],
					districtsByProvince: {},
					subdistrictsByDistrict: {},
					postalcodesBySubdistrict: {}
				};
				return state.dataIndex;
			})
			.finally(function () {
				state.dataPromise = null;
			});

		return state.dataPromise;
	}

	function getOptionsByLevel(dataIndex, locale, level, ids) {
		var source = locale.nameSource === 'en' ? 'en' : 'th';

		if (level === 'province') {
			var provinces = dataIndex.provinces.slice().sort(function (a, b) {
				return compareByNameSource(a, b, source);
			});
			return provinces.map(function (row) {
				return { value: row.id, label: row.names[source] || row.names.th || row.id };
			});
		}

		if (level === 'district') {
			var districts = dataIndex.districtsByProvince[normalizeValue(ids.pvId)] || [];
			districts = districts.slice().sort(function (a, b) {
				return compareByNameSource(a, b, source);
			});
			return districts.map(function (row) {
				return { value: row.id, label: row.names[source] || row.names.th || row.id };
			});
		}

		if (level === 'subdistrict') {
			var key = normalizeValue(ids.pvId) + ':' + normalizeValue(ids.dtId);
			var subdistricts = dataIndex.subdistrictsByDistrict[key] || [];
			subdistricts = subdistricts.slice().sort(function (a, b) {
				return compareByNameSource(a, b, source);
			});
			return subdistricts.map(function (row) {
				return { value: row.id, label: row.names[source] || row.names.th || row.id };
			});
		}

		if (level === 'postalcode') {
			var postalKey = normalizeValue(ids.pvId) + ':' + normalizeValue(ids.dtId) + ':' + normalizeValue(ids.sdtId);
			var postalcodes = dataIndex.postalcodesBySubdistrict[postalKey] || [];
			return postalcodes.map(function (row) {
				return { value: row.value, label: row.label };
			});
		}

		return [];
	}

	function renderOptions(field, locale, level, list, selectedValue, autoSelectWhenSingle) {
		if (!field) {
			return '';
		}

		field.innerHTML = '';
		var placeholder = document.createElement('option');
		placeholder.value = '';
		placeholder.textContent = list.length > 0 ? labelOf(locale, level) : labelOf(locale, 'nodata');
		field.appendChild(placeholder);

		list.forEach(function (item) {
			var option = document.createElement('option');
			option.value = normalizeValue(item.value);
			option.textContent = normalizeValue(item.label);
			field.appendChild(option);
		});

		field.disabled = false;
		var applied = applyValue(field, selectedValue);
		if (applied === '' && autoSelectWhenSingle && list.length === 1) {
			applied = applyValue(field, list[0].value);
		}
		return applied;
	}

	function markField(field, instanceId, fieldName, locale) {
		if (!field) {
			return;
		}
		field.setAttribute('data-jsata-instance', instanceId);
		field.setAttribute('data-jsata-field', fieldName);
		field.setAttribute('data-jsata-lang', locale.slug);
		field.setAttribute('data-jsata-name-source', locale.nameSource);
	}

	function localeFromField(field) {
		var slug = normalizeLangSlug(field && field.getAttribute ? field.getAttribute('data-jsata-lang') : '');
		var nameSource = normalizeLangSlug(field && field.getAttribute ? field.getAttribute('data-jsata-name-source') : '');

		if (slug && state.languagesBySlug[slug]) {
			return state.languagesBySlug[slug];
		}

		var fallback = defaultPackForSlug(slug || 'th');
		if (nameSource === 'th' || nameSource === 'en') {
			fallback.nameSource = nameSource;
		}
		return fallback;
	}

	function getInstanceFields(instanceId) {
		if (!instanceId) {
			return null;
		}

		var selector = '[data-jsata-instance="' + String(instanceId).replace(/"/g, '\\"') + '"]';
		return {
			instanceId: instanceId,
			province: document.querySelector(selector + '[data-jsata-field="province"]'),
			district: document.querySelector(selector + '[data-jsata-field="district"]'),
			subdistrict: document.querySelector(selector + '[data-jsata-field="subdistrict"]'),
			postalcode: document.querySelector(selector + '[data-jsata-field="postalcode"]')
		};
	}

	function initializeSet(dataIndex, set, locale) {
		var instanceId = 'jsata-' + String(++state.instanceCounter);
		var initialProvince = getInitialValue(set.province);
		var initialDistrict = getInitialValue(set.district);
		var initialSubdistrict = getInitialValue(set.subdistrict);
		var initialPostalcode = getInitialValue(set.postalcode);

		markField(set.province, instanceId, 'province', locale);
		markField(set.district, instanceId, 'district', locale);
		markField(set.subdistrict, instanceId, 'subdistrict', locale);
		markField(set.postalcode, instanceId, 'postalcode', locale);

		setInitializingFlag(set, true);

		var provinceOptions = getOptionsByLevel(dataIndex, locale, 'province', {});
		renderOptions(set.province, locale, 'province', provinceOptions, initialProvince, false);
		var provinceId = normalizeValue(set.province && set.province.value);

		if (!set.district) {
			setInitializingFlag(set, false);
			return;
		}

		if (provinceId === '') {
			resetField(set.district);
			resetField(set.subdistrict);
			resetField(set.postalcode);
			setInitializingFlag(set, false);
			return;
		}

		var districtOptions = getOptionsByLevel(dataIndex, locale, 'district', { pvId: provinceId });
		renderOptions(set.district, locale, 'district', districtOptions, initialDistrict, false);
		var districtId = normalizeValue(set.district && set.district.value);

		if (!set.subdistrict) {
			setInitializingFlag(set, false);
			return;
		}

		if (districtId === '') {
			resetField(set.subdistrict);
			resetField(set.postalcode);
			setInitializingFlag(set, false);
			return;
		}

		var subdistrictOptions = getOptionsByLevel(dataIndex, locale, 'subdistrict', {
			pvId: provinceId,
			dtId: districtId
		});
		renderOptions(set.subdistrict, locale, 'subdistrict', subdistrictOptions, initialSubdistrict, false);
		var subdistrictId = normalizeValue(set.subdistrict && set.subdistrict.value);

		if (!set.postalcode) {
			setInitializingFlag(set, false);
			return;
		}

		if (subdistrictId === '') {
			resetField(set.postalcode);
			setInitializingFlag(set, false);
			return;
		}

		var postalcodeOptions = getOptionsByLevel(dataIndex, locale, 'postalcode', {
			pvId: provinceId,
			dtId: districtId,
			sdtId: subdistrictId
		});
		renderOptions(set.postalcode, locale, 'postalcode', postalcodeOptions, initialPostalcode, true);
		setInitializingFlag(set, false);
	}

	function handleProvinceChange(field) {
		if (!state.dataIndex || !field || isInitializing(field)) {
			return;
		}

		var fields = getInstanceFields(field.getAttribute('data-jsata-instance'));
		if (!fields) {
			return;
		}

		var locale = localeFromField(field);
		var provinceId = normalizeValue(field.value);

		resetField(fields.subdistrict);
		resetField(fields.postalcode);

		if (!fields.district) {
			return;
		}

		if (provinceId === '') {
			resetField(fields.district);
			return;
		}

		var districtOptions = getOptionsByLevel(state.dataIndex, locale, 'district', { pvId: provinceId });
		renderOptions(fields.district, locale, 'district', districtOptions, '', false);
	}

	function handleDistrictChange(field) {
		if (!state.dataIndex || !field || isInitializing(field)) {
			return;
		}

		var fields = getInstanceFields(field.getAttribute('data-jsata-instance'));
		if (!fields) {
			return;
		}

		var locale = localeFromField(field);
		var districtId = normalizeValue(field.value);
		var provinceId = normalizeValue(fields.province && fields.province.value);

		resetField(fields.postalcode);

		if (!fields.subdistrict) {
			return;
		}

		if (districtId === '') {
			resetField(fields.subdistrict);
			return;
		}

		var subdistrictOptions = getOptionsByLevel(state.dataIndex, locale, 'subdistrict', {
			pvId: provinceId,
			dtId: districtId
		});
		renderOptions(fields.subdistrict, locale, 'subdistrict', subdistrictOptions, '', false);
	}

	function handleSubdistrictChange(field) {
		if (!state.dataIndex || !field || isInitializing(field)) {
			return;
		}

		var fields = getInstanceFields(field.getAttribute('data-jsata-instance'));
		if (!fields) {
			return;
		}

		var locale = localeFromField(field);
		var subdistrictId = normalizeValue(field.value);
		var provinceId = normalizeValue(fields.province && fields.province.value);
		var districtId = normalizeValue(fields.district && fields.district.value);

		if (!fields.postalcode) {
			return;
		}

		if (subdistrictId === '') {
			resetField(fields.postalcode);
			return;
		}

		var postalcodeOptions = getOptionsByLevel(state.dataIndex, locale, 'postalcode', {
			pvId: provinceId,
			dtId: districtId,
			sdtId: subdistrictId
		});
		renderOptions(fields.postalcode, locale, 'postalcode', postalcodeOptions, '', true);
	}

	function bindEventsOnce() {
		if (state.eventsBound) {
			return;
		}
		state.eventsBound = true;

		document.addEventListener('change', function (event) {
			var target = event.target;
			if (!target || !target.matches) {
				return;
			}

			if (target.matches(JSATA_SELECTORS.province)) {
				handleProvinceChange(target);
				return;
			}
			if (target.matches(JSATA_SELECTORS.district)) {
				handleDistrictChange(target);
				return;
			}
			if (target.matches(JSATA_SELECTORS.subdistrict)) {
				handleSubdistrictChange(target);
			}
		});
	}

	function initInternal(context, options) {
		var initOptions = asObject(options);
		var shouldReinitialize = initOptions.reinitialize === true || initOptions.forceReinitialize === true;

		return Promise.all([
			ensureAddressDataLoaded(initOptions),
			ensureLanguageLoaded(initOptions)
		]).then(function (resolved) {
			var dataIndex = resolved[0];
			var locale = resolved[1];

			bindEventsOnce();

			if (shouldReinitialize) {
				clearInstanceMarks(context);
			}

			var sets = discoverSets(context || document);
			sets.forEach(function (set) {
				initializeSet(dataIndex, set, locale);
			});

			return {
				sets: sets.length,
				lang: locale.slug
			};
		});
	}

	function initPublic(arg1, arg2) {
		var resolved = resolveInitArguments(arg1, arg2);
		return initInternal(resolved.context, resolved.options);
	}

	function handleCustomInitEvent(detail) {
		if (!detail) {
			return initPublic(document, {});
		}

		if (isPlainObject(detail) && (detail.context !== undefined || detail.options !== undefined || detail.lang !== undefined)) {
			var context = detail.context !== undefined ? detail.context : document;
			var options = asObject(detail.options);
			if (detail.lang !== undefined && options.lang === undefined) {
				options.lang = detail.lang;
			}
			return initPublic(context, options);
		}

		return initPublic(detail, {});
	}

	window.jsataInit = initPublic;
	window.jsataRefresh = initPublic;
	window.jsata = {
		init: initPublic,
		refresh: initPublic,
		loadAddressData: ensureAddressDataLoaded,
		loadLanguage: ensureLanguageLoaded,
		getAddressIndex: function () {
			return state.dataIndex;
		},
		getLanguagePack: function (slug) {
			var normalized = normalizeLangSlug(slug);
			return state.languagesBySlug[normalized] || null;
		}
	};

	function autoInitOnReady() {
		var cfg = getConfig();
		if (cfg.autoInit === false) {
			return;
		}
		initPublic(document, {}).catch(function (error) {
			console.error('[JSATA] ' + (error && error.message ? error.message : error));
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', autoInitOnReady);
	} else {
		autoInitOnReady();
	}

	document.addEventListener('jsata:init', function (event) {
		handleCustomInitEvent(event && event.detail ? event.detail : document).catch(function (error) {
			console.error('[JSATA] ' + (error && error.message ? error.message : error));
		});
	});

	if (window.jQuery) {
		window.jQuery(document).on('jsata:init', function (event, contextOrOptions, maybeOptions) {
			if (isPlainObject(contextOrOptions) && !isDomLikeContext(contextOrOptions)) {
				initPublic(contextOrOptions.context || document, contextOrOptions).catch(function (error) {
					console.error('[JSATA] ' + (error && error.message ? error.message : error));
				});
				return;
			}

			initPublic(contextOrOptions || document, asObject(maybeOptions)).catch(function (error) {
				console.error('[JSATA] ' + (error && error.message ? error.message : error));
			});
		});
	}
})(window, document);
