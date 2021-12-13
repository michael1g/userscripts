// ==UserScript==
// @name         CloudWatch Helper
// @namespace    https://github.com/MishaKav/userscripts/cloudwatch-helper
// @version      1.1.0
// @description  A userscript that adds ability to Hide Noise, Highlight the log level, Format the date and show message inside sns in json format
// @author       Misha Kav
// @copyright    2021, Misha Kav
// @match        https://*.console.aws.amazon.com/cloudwatch/*
// @icon         https://s3.amazonaws.com/cloudwatch-console-static-content-s3/1.0/images/favicon.ico
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @require      file:///Users/misha/Downloads/GithubSamples/userscripts/cloudwatch-helper.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js
// @updateURL    https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
// @supportURL   https://github.com/MishaKav/userscripts/issues
// ==/UserScript==

// @updateURL    https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
(function () {
  'use strict';
  // for local debug
  // @require      file:///Users/misha/Downloads/GithubSamples/userscripts/cloudwatch-helper.user.js

  const DATE_FORMAT = 'DD/MM/YY HH:mm:ss.SSS';
  const SELECTORS = {
    LOG_GROUP: {
      PANEL_ACTIONS: '.awsui-util-action-stripe-group',
      DATES: '.logs__log-events-table__timestamp-cell',
      LOG_ROW: 'tr span[data-testid=logs__log-events-table__message]',
      LOG_ROW_CLOSEST: 'tr',
      MESSAGE: "[data-testid='logs__log-events-table__message']",
      ALL_LOG_ROWS: '.awsui-table-row',
      EXPANDED_ROW: 'awsui-table-row-selected',
      MESSAGE_IN_LOG: '.logs__events__json-key',
      KEY_TO_PARSE: `"Message":`,
    },
    LOGS_INSIGHTS: {
      PANEL_ACTIONS: '.awsui-form-actions',
      DATES: '.logs-table__body-cell',
      HEADER_ROW: '.logs-table__header-cell',
      TABLE_ROW: '.logs-table__body-row .flex',
      TABLE_CELL: '.logs-table__body-cell',
      LOG_ROW_CLOSEST: 'div.flex',
      MESSAGE: '.logs-table__body-row .flex',
      ALL_LOG_ROWS: '.logs-table__body-row .flex',
      EXPANDED_ROW: 'logs-insights-expanded-row',
      MESSAGE_IN_LOG: 'td',
      KEY_TO_PARSE: 'Records.0.Sns.Message',
    },
  };
  let LOG_SELECTOR = SELECTORS.LOG_GROUP;
  const LOG_LEVELS = [
    { level: ['[TRACE]', 'TRACE'], color: '#888888' },
    { level: ['[DEBUG]', 'DEBUG'], color: '#4DC3FF' },
    { level: ['[INFO]', 'INFO'], color: '#4BB4BB' },
    { level: ['[WARNING]', '[WARN]', 'WARNING', 'WARN'], color: '#EFBC5F' },
    { level: ['[ERROR]', 'ERROR'], color: '#DE8686' },
    { level: ['[FATAL]', 'FATAL'], color: '#ff0000' },
  ];
  const NOISE_CONTENT = [
    'START RequestId',
    'END RequestId',
    'REPORT RequestId',
  ];

  const isLogGroupPage = () => location.href.includes('/log-group/');
  const isLogsInsightsPage = () => location.href.includes(':logs-insights');

  const getElements = (doc, selector) => [...doc.querySelectorAll(selector)];
  const getElement = (doc, selector) => getElements(doc, selector)[0];

  // some json beautify
  // https://gist.github.com/JGaudette/1ac2201c8e425fd41edc
  const prettyJson = (obj) => {
    let maxDepth = 250,
      depth = 0,
      root = true,
      sp = '    ';
    let objProp = (prop) => {
      if (prop === null) {
        return "<span style='color:#A6BE88; font-style:italic;'>null</span>,\n";
      }
      let t = (typeof prop + '').toLowerCase();
      if (
        Object.prototype.toString.apply(prop) === '[object Object]' ||
        Object.prototype.toString.apply(prop) === '[object Array]'
      ) {
        return branch(prop).replace(/\n/gim, '\n' + sp) + ',\n';
      } else if (t === 'function') {
        return (
          "<span style='color:#0A0;'>" +
          (prop + '')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace(
              /function\s?\(/,
              'function <strong>' +
                ((prop.constructor && prop.constructor.name) ||
                  prop.name ||
                  '') +
                '</strong>('
            )
            .replace(/\n/gim, '\n    ') +
          '</span>,\n'
        );
      } else if (t === 'string') {
        return '<span>"' + prop + '"</span>,\n';
      } else if (t === 'number') {
        return "<span style='color:#F00;'>" + prop + '</span>,\n';
      } else if (t === 'boolean') {
        return (
          "<span style='color:#00D;'>" +
          (prop === true ? 'true' : 'false') +
          '</span>,\n'
        );
      }
      return (
        (prop.toSource || prop.toString)().replace(/^\((new\s)?(.+)\)$/, '$2') +
        ',\n'
      );
    };

    let branch = (what) => {
      let wasRoot = root === true,
        x,
        dig,
        text = '',
        m = 0;
      root = false;
      if (depth > maxDepth) {
        return "<span style='color:#AAA; font-style:italic;'>[Maximum Depth Reached]</span>";
      }
      depth++;
      if (Object.prototype.toString.apply(what) === '[object Array]') {
        text =
          "<pre style='color:#555; display:" +
          (wasRoot === false ? 'inline' : 'block') +
          "; margin:0; padding:0;'><strong>[</strong>\n";
        for (x = 0; x < what.length; x++) {
          dig = (x + '# ').length;
          text +=
            sp.substring(0, 4 - dig) +
            "<span style='color:#ABC; font-style:italic;'>#" +
            x +
            '</span> ' +
            objProp(what[x]);
        }
        return text.replace(/\,\n$/, '\n') + '<strong>]</strong></pre>';
      } else if (Object.prototype.toString.apply(what) === '[object Object]') {
        text =
          "<pre style='color:#555; display:" +
          (wasRoot === false ? 'inline' : 'block') +
          "; margin:0; padding:0;'><strong>{</strong>\n";
        for (x in what) {
          if (what.hasOwnProperty(x)) {
            m = Math.max(m, (x + '').length);
          }
        }
        m += 1;
        for (x in what) {
          if (what.hasOwnProperty(x)) {
            text +=
              sp +
              "<span style='color:#089;'>" +
              x +
              '</span>' +
              new Array(m - (x + '').length).join(' ') +
              ' : ' +
              objProp(what[x]);
          }
        }
        return text.replace(/\,\n$/, '\n') + '<strong>}</strong></pre>';
      }
    };

    let r = branch(obj);
    sp = root = branch = objProp = null;
    return r;
  };

  const getInsightsMessages = (doc) => {
    const messageIndex = [
      ...getElements(doc, LOG_SELECTOR.HEADER_ROW),
    ].findIndex((c) => c.innerText.includes('@message'));

    if (messageIndex) {
      return [...getElements(doc, LOG_SELECTOR.TABLE_ROW)].flatMap((row) =>
        [...row.querySelectorAll(LOG_SELECTOR.TABLE_CELL)].filter(
          (_, i) => i === messageIndex
        )
      );
    }

    return [];
  };

  const getDates = (doc) => {
    if (isLogGroupPage()) {
      return getElements(doc, LOG_SELECTOR.DATES);
    }

    if (isLogsInsightsPage()) {
      const tsIndex = [...getElements(doc, LOG_SELECTOR.HEADER_ROW)].findIndex(
        (c) => c.innerText.includes('@timestamp')
      );
      if (tsIndex) {
        return [...getElements(doc, LOG_SELECTOR.TABLE_ROW)].flatMap((row) =>
          [...row.querySelectorAll(LOG_SELECTOR.TABLE_CELL)].filter(
            (_, i) => i === tsIndex
          )
        );
      }
    }

    return [];
  };

  const shortDates = (doc) => {
    const dates = getDates(doc);

    dates.forEach((d) => {
      const originalDate = d.innerText;
      d.setAttribute('original-date', originalDate);
      d.innerText = moment(originalDate).format(DATE_FORMAT);
    });
  };

  const originalDates = (doc) => {
    const dates = getDates(doc);

    dates.forEach((d) => {
      d.innerText = d.getAttribute('original-date');
    });
  };

  const getLogRows = (doc) => {
    if (isLogGroupPage()) {
      return getElements(doc, LOG_SELECTOR.LOG_ROW);
    }

    if (isLogsInsightsPage()) {
      return getInsightsMessages(doc);
    }

    return [];
  };

  const toggleNoise = (doc, hide = true) => {
    const noise = getLogRows(doc);

    noise.forEach((node) => {
      const shouldHide = NOISE_CONTENT.some((n) =>
        node.innerText.startsWith(n)
      );

      if (shouldHide) {
        node.closest(LOG_SELECTOR.LOG_ROW_CLOSEST).style.display = hide
          ? 'none'
          : '';
      }
    });
  };

  const getMessagesRows = (doc) => {
    if (isLogGroupPage()) {
      return getElements(doc, LOG_SELECTOR.MESSAGE);
    }

    if (isLogsInsightsPage()) {
      return getInsightsMessages(doc);
    }

    return [];
  };

  const highlightDebug = (doc, highlight = true) => {
    const messages = getMessagesRows(doc);

    messages.forEach((d) => {
      const msg = d.innerText;
      const log = LOG_LEVELS.find((l) =>
        l.level.find((ll) => msg.includes(ll))
      );
      let text;

      if (log) {
        const splitByLog = log.level.find((l) => msg.includes(l));

        if (highlight) {
          text = msg
            .split(splitByLog)
            .join(`<b style="color:${log.color}">${splitByLog}</b>`);
        } else {
          text = msg
            .split(`<b style="color:${log.color}">${splitByLog}</b>`)
            .join(splitByLog);
        }

        d.innerHTML = text;
      }
    });
  };

  const initButtonsPanel = (doc) => {
    const cwPanel = doc.getElementById('cw-panel');

    // already initialise
    if (cwPanel) {
      return;
    }

    const awsPanel = getElement(doc, LOG_SELECTOR.PANEL_ACTIONS);
    const panel = document.createElement('div');
    panel.innerHTML = `
    <div id="cw-panel">
      <label for="cw-hide-noise">
        <input type="checkbox" id="cw-hide-noise" /> Hide Noise
      </label>

      <label for="cw-highlight-debug">
        <input type="checkbox" id="cw-highlight-debug" /> Highlight
      </label>

      <label for="cw-format-date">
        <input type="checkbox" id="cw-format-date" /> Format Date
      </label>
    </div>`;

    awsPanel.appendChild(panel);

    const noiseCheckbox = doc.getElementById('cw-hide-noise');
    const highlightCheckbox = doc.getElementById('cw-highlight-debug');
    const dateCheckbox = doc.getElementById('cw-format-date');

    noiseCheckbox.addEventListener('change', (event) => {
      const { checked } = event.currentTarget;
      toggleNoise(doc, checked);
    });

    highlightCheckbox.addEventListener('change', (event) => {
      const { checked } = event.currentTarget;
      highlightDebug(doc, checked);
    });

    dateCheckbox.addEventListener('change', (event) => {
      const { checked } = event.currentTarget;
      if (checked) {
        shortDates(doc);
      } else {
        originalDates(doc);
      }
    });
  };

  const rowIsExpanded = (row) => {
    if (isLogGroupPage()) {
      return row.classList.contains(LOG_SELECTOR.EXPANDED_ROW);
    }

    if (isLogsInsightsPage()) {
      return row.nextSibling?.classList.contains(LOG_SELECTOR.EXPANDED_ROW);
    }

    return false;
  };

  const getKeysForMessage = (row) => {
    if (isLogGroupPage()) {
      return getElements(row, LOG_SELECTOR.MESSAGE_IN_LOG);
    }

    if (isLogsInsightsPage()) {
      return getElements(row.nextSibling, LOG_SELECTOR.MESSAGE_IN_LOG);
    }

    return [];
  };

  const getBeautifyJsonElement = (row) => {
    if (isLogGroupPage()) {
      return row;
    }

    if (isLogsInsightsPage()) {
      return row?.nextSibling;
    }

    return null;
  };

  const onRowClick = (event) => {
    const { target } = event;
    const row = target.closest(LOG_SELECTOR.LOG_ROW_CLOSEST);
    const isExpanded = rowIsExpanded(row);

    if (isExpanded) {
      const allKeys = getKeysForMessage(row);
      const msg = allKeys.find(
        (k) => k.innerText === LOG_SELECTOR.KEY_TO_PARSE
      );

      if (msg && !msg.getAttribute('beautify-json')) {
        msg.setAttribute('beautify-json', true);
        msg.style = 'cursor: pointer';
        const div = getBeautifyJsonElement(row);
        div.addEventListener('click', beautifyJson);
      }
    }
  };

  const parseStringToJson = (jsonStr) => {
    if (isLogGroupPage()) {
      return JSON.parse(JSON.parse(jsonStr)); // to escape encodings;
    }

    if (isLogsInsightsPage()) {
      return JSON.parse(jsonStr);
    }

    return {};
  };

  const beautifyJson = (event) => {
    const { target: msg } = event;
    const jsonElement = msg.nextElementSibling;

    if (!jsonElement) {
      return;
    }

    // click on object inside message
    if (jsonElement.parentElement.nodeName === 'PRE') {
      return;
    }

    if (getElement(jsonElement, 'pre')) {
      jsonElement.innerHTML = jsonElement.getAttribute('original-msg');
    } else {
      const jsonStr = jsonElement.innerText;
      const msgObj = parseStringToJson(jsonStr);
      jsonElement.setAttribute('original-msg', jsonStr);
      jsonElement.innerHTML = prettyJson(msgObj);
    }
  };

  const addRowEventListiner = (doc) => {
    const allRows = getElements(doc, LOG_SELECTOR.ALL_LOG_ROWS);
    const rows = allRows.filter((r) => !r.getAttribute('custom-handler'));

    rows.forEach((row) => {
      // it take time to expand row with relevant data
      const ms = isLogGroupPage() ? 200 : 500;
      row.setAttribute('custom-handler', true);
      row.addEventListener('click', (e) => setTimeout(() => onRowClick(e), ms));
    });
  };

  const runInitTimeout = () =>
    setTimeout(() => {
      window.requestAnimationFrame(init);
    }, 1000);

  const init = () => {
    if (!isLogGroupPage() && !isLogsInsightsPage()) {
      return;
    }

    if (isLogGroupPage()) {
      LOG_SELECTOR = SELECTORS.LOG_GROUP;
    }

    if (isLogsInsightsPage()) {
      LOG_SELECTOR = SELECTORS.LOGS_INSIGHTS;
    }

    const iframe = document.getElementById('microConsole-Logs');

    if (iframe) {
      const innerDocument = iframe.contentDocument
        ? iframe.contentDocument
        : iframe.contentWindow;

      if (innerDocument) {
        const panel = getElement(innerDocument, LOG_SELECTOR.PANEL_ACTIONS);
        const logs = getElement(innerDocument, LOG_SELECTOR.MESSAGE);

        if (panel) {
          initButtonsPanel(innerDocument);
        }

        if (logs) {
          addRowEventListiner(innerDocument);
          return;
        }
      }
    }

    // run setTimeout again
    runInitTimeout();
  };

  runInitTimeout();
  window.addEventListener('hashchange', runInitTimeout, false);
})();
