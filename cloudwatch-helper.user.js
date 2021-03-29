// ==UserScript==
// @name         CloudWatch Helper
// @namespace    https://github.com/MishaKav/userscripts/cloudwatch-helper
// @version      1.0.0
// @description  A userscript that adds simple buttons to help see the logs of sns
// @author       Misha Kav
// @copyright    2021, Misha Kav
// @match        https://*.console.aws.amazon.com/cloudwatch/*
// @icon         https://s3.amazonaws.com/cloudwatch-console-static-content-s3/1.0/images/favicon.ico
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js
// @updateURL    https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/MishaKav/userscripts/main/cloudwatch-helper.user.js
// @supportURL   https://github.com/MishaKav/userscripts/issues
// ==/UserScript==

(function () {
  "use strict";
  // for local debug
  // @require      file:///Users/misha/Downloads/GithubSamples/userscripts/cloudwatch-helper.user.js

  const DATE_FORMAT = "DD/MM/YY HH:mm:ss.SSS";
  const DATES_SELECTOR = ".logs__log-events-table__timestamp-cell";
  const MESSAGE_SELECTOR = "[data-testid='logs__log-events-table__message']";
  const LOG_LEVELS = [
    { level: "[TRACE]", color: "#888888" },
    { level: "[DEBUG]", color: "#4DC3FF" },
    { level: "[INFO]", color: "#4BB4BB" },
    { level: "[WARN]", color: "#FFFF80" },
    { level: "[ERROR]", color: "#FFB3B3" },
    { level: "[FATAL]", color: "#ff0000" },
  ];
  const NOISE_CONTENT = [
    "START RequestId",
    "END RequestId",
    "REPORT RequestId",
  ];

  const isLogGroupPage = () => location.href.includes("/log-group/");

  const getElements = (doc, selector) => [...doc.querySelectorAll(selector)];
  const getElement = (doc, selector) => getElements(doc, selector)[0];

  // some json beautify
  // https://gist.github.com/JGaudette/1ac2201c8e425fd41edc
  const prettyJson = (obj) => {
    let maxDepth = 250,
      depth = 0,
      root = true,
      sp = "    ";
    let objProp = (prop) => {
      if (prop === null) {
        return "<span style='color:#A6BE88; font-style:italic;'>null</span>,\n";
      }
      let t = (typeof prop + "").toLowerCase();
      if (
        Object.prototype.toString.apply(prop) === "[object Object]" ||
        Object.prototype.toString.apply(prop) === "[object Array]"
      ) {
        return branch(prop).replace(/\n/gim, "\n" + sp) + ",\n";
      } else if (t === "function") {
        return (
          "<span style='color:#0A0;'>" +
          (prop + "")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace(
              /function\s?\(/,
              "function <strong>" +
                ((prop.constructor && prop.constructor.name) ||
                  prop.name ||
                  "") +
                "</strong>("
            )
            .replace(/\n/gim, "\n    ") +
          "</span>,\n"
        );
      } else if (t === "string") {
        return '<span>"' + prop + '"</span>,\n';
      } else if (t === "number") {
        return "<span style='color:#F00;'>" + prop + "</span>,\n";
      } else if (t === "boolean") {
        return (
          "<span style='color:#00D;'>" +
          (prop === true ? "true" : "false") +
          "</span>,\n"
        );
      }
      return (
        (prop.toSource || prop.toString)().replace(/^\((new\s)?(.+)\)$/, "$2") +
        ",\n"
      );
    };

    let branch = (what) => {
      let wasRoot = root === true,
        x,
        dig,
        text = "",
        m = 0;
      root = false;
      if (depth > maxDepth) {
        return "<span style='color:#AAA; font-style:italic;'>[Maximum Depth Reached]</span>";
      }
      depth++;
      if (Object.prototype.toString.apply(what) === "[object Array]") {
        text =
          "<pre style='color:#555; display:" +
          (wasRoot === false ? "inline" : "block") +
          "; margin:0; padding:0;'><strong>[</strong>\n";
        for (x = 0; x < what.length; x++) {
          dig = (x + "# ").length;
          text +=
            sp.substring(0, 4 - dig) +
            "<span style='color:#ABC; font-style:italic;'>#" +
            x +
            "</span> " +
            objProp(what[x]);
        }
        return text.replace(/\,\n$/, "\n") + "<strong>]</strong></pre>";
      } else if (Object.prototype.toString.apply(what) === "[object Object]") {
        text =
          "<pre style='color:#555; display:" +
          (wasRoot === false ? "inline" : "block") +
          "; margin:0; padding:0;'><strong>{</strong>\n";
        for (x in what) {
          if (what.hasOwnProperty(x)) {
            m = Math.max(m, (x + "").length);
          }
        }
        m += 1;
        for (x in what) {
          if (what.hasOwnProperty(x)) {
            text +=
              sp +
              "<span style='color:#089;'>" +
              x +
              "</span>" +
              new Array(m - (x + "").length).join(" ") +
              " : " +
              objProp(what[x]);
          }
        }
        return text.replace(/\,\n$/, "\n") + "<strong>}</strong></pre>";
      }
    };

    let r = branch(obj);
    sp = root = branch = objProp = null;
    return r;
  };

  const shortDates = (doc) => {
    const dates = getElements(doc, DATES_SELECTOR);

    dates.forEach((d) => {
      const originalDate = d.innerText;
      d.setAttribute("original-date", originalDate);
      d.innerText = moment(originalDate).format(DATE_FORMAT);
    });
  };

  const originalDates = (doc) => {
    const dates = getElements(doc, DATES_SELECTOR);

    dates.forEach((d) => {
      d.innerText = d.getAttribute("original-date");
    });
  };

  const toggleNoise = (doc, hide = true) => {
    const noise = getElements(
      doc,
      "tr span[data-testid=logs__log-events-table__message]"
    );
    noise.forEach((node) => {
      const shouldHide = NOISE_CONTENT.some((n) =>
        node.innerText.startsWith(n)
      );

      if (shouldHide) {
        node.closest("tr").style.display = hide ? "none" : "";
      }
    });
  };

  const highlightDebug = (doc, highlight = true) => {
    const messages = getElements(doc, MESSAGE_SELECTOR);

    messages.forEach((d) => {
      const msg = d.innerText;
      const log = LOG_LEVELS.find((l) => msg.includes(l.level));
      let text;

      if (log) {
        if (highlight) {
          text = msg
            .split(log.level)
            .join(`<b style="color:${log.color}">${log.level}</b>`);
        } else {
          text = msg
            .split(`<b style="color:${log.color}">${log.level}</b>`)
            .join(log.level);
        }

        d.innerHTML = text;
      }
    });
  };

  const initButtonsPanel = (doc) => {
    const cwPanel = doc.getElementById("cw-panel");

    // already initialise
    if (cwPanel) {
      return;
    }

    const awsPanel = getElement(doc, ".awsui-util-action-stripe-group");
    const panel = document.createElement("div");
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

    const noiseCheckbox = doc.getElementById("cw-hide-noise");
    const highlightCheckbox = doc.getElementById("cw-highlight-debug");
    const dateCheckbox = doc.getElementById("cw-format-date");

    noiseCheckbox.addEventListener("change", (event) => {
      const { checked } = event.currentTarget;
      toggleNoise(doc, checked);
    });

    highlightCheckbox.addEventListener("change", (event) => {
      const { checked } = event.currentTarget;
      highlightDebug(doc, checked);
    });

    dateCheckbox.addEventListener("change", (event) => {
      const { checked } = event.currentTarget;
      if (checked) {
        shortDates(doc);
      } else {
        originalDates(doc);
      }
    });
  };

  const onRowClick = (event) => {
    const { target } = event;
    const row = target.closest("tr");
    const isExpanded = row.classList.contains("awsui-table-row-selected");

    if (isExpanded) {
      const allKeys = getElements(row, ".logs__events__json-key");
      const msg = allKeys.find((k) => k.innerText === `"Message":`);

      if (msg && !msg.getAttribute("beautify-json")) {
        msg.setAttribute("beautify-json", true);
        msg.style = "cursor: pointer";
        row.addEventListener("click", beautifyJson);
      }
    }
  };

  const beautifyJson = (event) => {
    const { target: msg } = event;
    const jsonElement = msg.nextElementSibling;

    if (!jsonElement) {
      return;
    }

    // click on object inside message
    if (jsonElement.parentElement.nodeName === "PRE") {
      return;
    }

    if (getElement(jsonElement, "pre")) {
      jsonElement.innerHTML = jsonElement.getAttribute("original-msg");
    } else {
      const jsonStr = jsonElement.innerText;
      const msgObj = JSON.parse(JSON.parse(jsonStr)); // to escape encodings
      jsonElement.setAttribute("original-msg", jsonStr);
      jsonElement.innerHTML = prettyJson(msgObj);
    }
  };

  const addRowEventListiner = (doc) => {
    const allRows = getElements(doc, ".awsui-table-row");
    const rows = allRows.filter((r) => !r.getAttribute("custom-handler"));

    rows.forEach((row) => {
      // it take time to expand row with relevant data
      row.setAttribute("custom-handler", true);
      row.addEventListener("click", (e) =>
        setTimeout(() => onRowClick(e), 200)
      );
    });
  };

  const runInitTimeout = () =>
    setTimeout(() => {
      window.requestAnimationFrame(init);
    }, 1000);

  const init = () => {
    if (!isLogGroupPage()) {
      return;
    }

    const iframe = document.getElementById("microConsole-Logs");

    if (iframe) {
      const innerDocument = iframe.contentDocument
        ? iframe.contentDocument
        : iframe.contentWindow;

      if (innerDocument) {
        const panel = getElement(
          innerDocument,
          ".awsui-util-action-stripe-group"
        );
        const logs = getElement(innerDocument, MESSAGE_SELECTOR);

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
  window.addEventListener("hashchange", runInitTimeout, false);
})();
