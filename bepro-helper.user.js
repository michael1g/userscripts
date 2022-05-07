// ==UserScript==
// @name        BePro Global Export
// @namespace   https://issta.beprotravel.com/
// @version     1.0.0
// @description This userscript send help to fill some order information in external systems
// @author      Misha Kav
// @copyright   2022, Misha Kav
// @icon        https://issta.beprotravel.com/favicon.ico
// @icon64      https://issta.beprotravel.com/favicon.ico
// @homepage    https://issta.beprotravel.com/
// @match       *://issta.beprotravel.com/*
// @match       *.travelbooster.com/*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @run-at      document-end
// @updateURL   https://raw.githubusercontent.com/MishaKav/userscripts/bepro/bepro-helper.user.js
// @downloadURL https://raw.githubusercontent.com/MishaKav/userscripts/bepro/bepro-helper.user.js
// @supportURL  https://github.com/MishaKav/userscripts/issues
// ==/UserScript==

/* global $, jQuery, NC */

(function () {
  'use strict';

  let _Order;
  const TIMEOUT = 400;

  const SUPPLIERS = {
    gogb: 'GO GLOBAL TRAVEL',
    ean1: 'EXPEDIA',
    ean2: 'EXPEDIA',
    ean7: 'EXPEDIA',
  };

  const STATUSES = {
    OK: 'OK',
    RQ: 'Request',
    SO: 'SoldOut',
    XX: 'CancelledWithNoConfirm',
    CX: 'CancelledWithConfirm',
  };

  // for local debug
  // @require      file:///Users/misha/Downloads/GithubSamples/userscripts/bepro-helper.user.js

  // ===== UTILS =====
  const sleep = (ms = TIMEOUT) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const isBeProSite = () => location.href.includes('beprotravel');
  const isTravelBoosterSite = () => location.href.includes('travelbooster');
  const isEmptyObject = (obj) =>
    obj == null ||
    (obj && obj.constructor === Object && Object.keys(obj).length === 0);
  const isNotEmptyObject = (obj) => !isEmptyObject(obj);
  const getQueryStringByName = (name, url) => {
    if (!url) {
      url = window.location.href;
    }

    name = name.replace(/[\[\]]/g, '\\$&');

    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);

    if (!results) {
      return null;
    }

    if (!results[2]) {
      return '';
    }

    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  };
  // ===== UTILS =====

  init();

  async function init() {
    initBeProSite();
    loadOrderFromStorage();
    await initTravelBooster();

    if (isNotEmptyObject(_Order)) {
      const { OrderSegId } = _Order;

      // GM_registerMenuCommand(`Load Order #${OrderSegId}`, loadOrderFromStorage);
      GM_registerMenuCommand(`Fill Details #${OrderSegId}`, fillHotelDetails);
      GM_registerMenuCommand(`See Details #${OrderSegId}`, seeHotelDetails);
    }
  }

  function initBeProSite() {
    if (isBeProSite() && $('#wid-id-myorders').length > 0) {
      // track change order on b2b
      $('#ActiveOrder').on('DOMSubtreeModified', () => {
        if (isNotEmptyObject(NC.Widgets.B2B.MyOrdersWidget._CurrentOrder)) {
          _Order = NC.Widgets.B2B.MyOrdersWidget._CurrentOrder;
          // prettier-ignore
          // NC.Widgets.B2B.Utils.SmallSuccessBox('Order Remembered Successfully: ' + _Order.OrderRow.SegmentId);
          makeTravelBoosterUrl();
        }
      });

      // $('#wid-id-myorders header span:first').after(
      //   "<button id='MakeLink' class='btn btn-xs btn-warning margin-top-5'>Make Link</button>"
      // );

      // $('#MakeLink').click(() => {
      //   if (isNotEmptyObject(NC.Widgets.B2B.MyOrdersWidget._CurrentOrder)) {
      //     _Order = NC.Widgets.B2B.MyOrdersWidget._CurrentOrder;
      //     //RegisterCommand(_Order.OrderRow.SegmentId);
      //     NC.Widgets.B2B.Utils.SmallSuccessBox(
      //       'Order Remembered Successfully: ' + _Order.OrderRow.SegmentId
      //     );

      //     makeTravelBoosterUrl();
      //   } else {
      //     NC.Widgets.B2B.Utils.SmallWarningBox(
      //       'Please, Select the Order first'
      //     );
      //   }
      // });
    }
  }

  function makeTravelBoosterUrl() {
    if (isNotEmptyObject(_Order)) {
      const [segment] = _Order.Order.Segments;
      const isHotel = segment.ProductType === 'HTL';
      const {
        OrderSegId,
        SuppPnr,
        ItemDesc,
        ItemStarRateCode,
        RoomsStatusCode,
        CheckIn,
        CheckOut,
        RoomsFirstCXL,
        SysTotalGross,
        SysTotalGross2,
        SysSuppCode,
        Rooms,
        SysCurrencyCode,
        NumberOfNights,
        ItemAddress,
        SuppCityDesc,
        ItemPhone,
        ItemFax,
        ItemZip,
      } = segment;
      const Paxes = _Order.Order.Paxes.map((p) => ({
        Country: p.Country,
        DOB: p.DOB,
        FirstName: p.FirstName,
        LastName: p.LastName,
        Gender: p.Gender,
        PaxTitle: p.PaxTitle,
        Mobile1: p.Mobile1,
        Phone1: p.Phone1,
      }));
      const miniOrder = {
        OrderSegId,
        SuppPnr,
        ItemDesc,
        ItemStarRateCode,
        RoomsStatusCode,
        CheckIn,
        CheckOut,
        RoomsFirstCXL,
        SysTotalGross,
        SysTotalGross2,
        SysSuppCode,
        SysBasisCode: isHotel && Rooms[0].SysBasisCode,
        SysCurrencyCode,
        NumberOfNights,
        ItemAddress,
        SuppCityDesc,
        ItemPhone,
        ItemFax,
        ItemZip,
        Paxes,
      };

      const isSupportedSupplier = SUPPLIERS[SysSuppCode] != null;
      const disabled = isHotel && isSupportedSupplier ? '' : 'disabled';
      const queryString = `Order=${encodeURIComponent(
        JSON.stringify(miniOrder)
      )}`;

      $('#TravelBoosterUrl').remove();
      $('#wid-id-myorders header span:first').after(
        `<a target='_blank' id='TravelBoosterUrl' 
        class='btn btn-xs btn-danger margin-top-5 margin-top-5 ${disabled}' 
        href='https://b2e-genesis-out.travelbooster.com/UI_NET/Services/Hotel/Index.aspx?${queryString}'>
          Travel Booster #${_Order.OrderRow.SegmentId}
         </a>`
      );
    }
    // NC.Widgets.B2B.Utils.SmallWarningBox('Please, Select the Order first');
  }

  async function initTravelBooster() {
    if (isTravelBoosterSite()) {
      saveOrderFromQueryStringToStorage();
      await sleep();
      addHotelButtons();
      addPaxesButtons();
    }
  }

  function addHotelButtons() {
    if (!jQuery || !jQuery().jquery) {
      return;
    }

    const order = JSON.stringify(_Order, null, 2);
    jQuery('[id*=tabControlMain_G2Panel2').before(
      `<br/>
      <details>
          <summary>Details #${_Order.OrderSegId}</summary>
          <pre>${order}</pre>
       </details>`
    );
    jQuery('[id*=frmTransact_btnContinue').before(
      `<input type="button" id="FillSaveDetails" class="button marginAltSide10"
          style="background-color: #356e35"
          value="Fill & Save"
       />`
    );
    jQuery('[id*=frmTransact_btnContinue').before(
      `<input type="button" id="FillDetails" class="button marginAltSide10"
          style="background-color: #356e35"
          value="Fill"
       />`
    );

    jQuery('#FillDetails').click(fillHotelDetails);
    jQuery('#FillSaveDetails').click(() =>
      fillHotelDetails({ shouldSave: true })
    );
  }

  function addPaxesButtons() {
    if (!jQuery || !jQuery().jquery) {
      return;
    }

    const order = JSON.stringify(_Order.Paxes, null, 2);
    jQuery('[id*=CustomersList1_pnlCustomers').before(
      `<details>
          <summary>Details #${_Order.OrderSegId} (${_Order.Paxes.length} Paxes)</summary>
          <pre>${order}</pre>
       </details>`
    );

    jQuery('[id*=InformationContent_btnContinue').before(
      `<input type="button" id="FillPaxes" class="button marginAltSide10"
          style="background-color: #356e35"
          value="Fill"
       />`
    );

    jQuery('#FillPaxes').click(fillPaxesDetails);
  }

  async function fillPaxesDetails() {
    if (isTravelBoosterSite() && isNotEmptyObject(_Order)) {
      for (let i = 0; i < _Order.Paxes.length - 1; i++) {
        jQuery('[id*=CustomersList1_btnAddPax]').click();
        await sleep();
      }
    }
  }

  function seeHotelDetails() {
    const order = _Order || 'No Order Details';
    alert(JSON.stringify(order, null, 2));
  }

  async function fillHotelDetails(options = {}) {
    if (isTravelBoosterSite() && isNotEmptyObject(_Order)) {
      fillGeneralDetails();
      fillDates();
      fillReservation();
      fillAddress();

      await sleep(1000);
      showPricingTab(options);
    }
  }

  async function showPricingTab(options = {}) {
    jQuery('[id*=tabPassengers_A]').trigger(jQuery.Event('click'));
    await addPax(options);
  }

  async function addPax(options = {}) {
    jQuery('[id*=dlCustomers_ctl01_chkSelected]')
      .prop('checked', true)
      .trigger(jQuery.Event('change'));
    await sleep();
    await addCurrency(options);
  }

  async function addCurrency(options = {}) {
    const { SysCurrencyCode = 'USD' } = _Order;

    jQuery('[id*=editCustomers_frmTransact_ddlCurrency]')
      .val(SysCurrencyCode)
      .trigger(jQuery.Event('change'));

    await sleep();
    await addPrice(options);
    await sleep();
    await addPrice(options);
  }

  async function addPrice({ shouldSave }) {
    const { SysTotalGross, SysTotalGross2, OrderSegId } = _Order;

    jQuery('[id*=ctl01_txtNet]')
      .val(SysTotalGross)
      .trigger(jQuery.Event('change'));
    jQuery('[id*=ctl01_txtSellPrice]')
      .val(SysTotalGross2)
      .trigger(jQuery.Event('change'));

    console.log(`Finish To Fill Order: #${OrderSegId}`);

    if (shouldSave) {
      jQuery('[id*=frmTransact_btnContinue').click();
    }
  }

  function saveOrderFromQueryStringToStorage() {
    const orderQueryString = getQueryStringByName('Order');

    if (isNotEmptyObject(orderQueryString)) {
      const decodeOrderString = decodeURIComponent(orderQueryString);
      _Order = JSON.parse(decodeOrderString);
      saveOrderToStorage();
      // fillHotelDetails();
    }
  }

  function fillGeneralDetails() {
    jQuery('[id*=tabControlMain_txtDesc]').val(_Order.ItemDesc);
    fillSupplier();
    fillDestination();
  }

  function fillSupplier() {
    jQuery('[id*=cbResSupp_Widget]').trigger(jQuery.Event('click'));
    const { SysSuppCode } = _Order;
    const supplierText = SUPPLIERS[SysSuppCode] ? SUPPLIERS[SysSuppCode] : null;

    if (supplierText) {
      setTimeout(() => {
        jQuery('[id*=HotelSuppliersWithDetails]')
          .find(`[text='${supplierText}']`)
          .trigger(jQuery.Event('click'));
      }, TIMEOUT);
    }
  }

  function fillDestination() {
    // jQuery('[id*=cbAreas_tbAutoComplete]').val(_Order.SuppCityDesc);
    jQuery('[id*=cbAreas_tbAutoComplete]').val('Tel Aviv, TLV, Israel, ');
    jQuery('[id*=cbAreas_hfAutoComplete]').val(4455); // Tel Aviv, TLV, Israel,
  }

  function fillDates() {
    const { CheckIn, CheckOut } = _Order;
    const checkIn = new Date(CheckIn);
    const checkInDate = ('0' + checkIn.getDate()).slice(-2);
    const checkInMonth = ('0' + (checkIn.getMonth() + 1)).slice(-2);
    const checkInYear = checkIn.getFullYear();
    const checkInString = `${checkInDate}/${checkInMonth}/${checkInYear}`;
    const checkOut = new Date(CheckOut);
    const checkOutDate = ('0' + checkOut.getDate()).slice(-2);
    const checkOutMonth = ('0' + (checkOut.getMonth() + 1)).slice(-2);
    const checkOutYear = checkOut.getFullYear();
    const checkOutString = `${checkOutDate}/${checkOutMonth}/${checkOutYear}`;

    jQuery('[id*=frmDates_dsStartDate_hfDate]')
      .val(checkInString)
      .trigger('change');
    jQuery('[id*=frmDates_dsEndDate_hfDate]')
      .val(checkOutString)
      .trigger('change');
  }

  function fillReservation() {
    const { OrderSegId, SuppPnr } = _Order;

    fillStatus();
    jQuery('[id*=tabControlMain_txtConfWidth]').val(`BePro: ${OrderSegId}`);
    jQuery('[id*=G2DataForm4_txtReservation]').val(SuppPnr);
  }

  function fillStatus() {
    const { RoomsStatusCode } = _Order;
    const statusValue = STATUSES[RoomsStatusCode]
      ? STATUSES[RoomsStatusCode]
      : 'None';

    jQuery('[id*=G2DataForm4_ddlStatus]').val(statusValue);
  }

  function fillAddress() {
    const { ItemAddress, SuppCityDesc, ItemZip, ItemPhone, ItemFax } = _Order;

    jQuery('[id*=productAddress_tbAddress]').val(ItemAddress);
    jQuery('[id*=productAddress_tbCity]').val(SuppCityDesc);
    jQuery('[id*=productAddress_tbZip]').val(ItemZip);
    jQuery('[id*=G2DataForm1_txtPhone1]').val(ItemPhone);
    jQuery('[id*=tabControlMain_txtFax]').val(ItemFax);
  }

  function saveOrderToStorage() {
    if (isNotEmptyObject(_Order)) {
      GM_setValue('Order', JSON.stringify(_Order));
      // console.log('Order Saved Successfully', _Order.OrderSegId);
    }
  }

  function loadOrderFromStorage() {
    const order = GM_getValue('Order');

    if (isNotEmptyObject(order)) {
      _Order = JSON.parse(order);
      // console.log('Load Order from Storage', _Order);
    }
  }
})();
