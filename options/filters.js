'use strict';
browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request && request.message !== 'addSubscription') {
    return;
  } else if (!request) {
    return;
  }

  var title = request.title || request.url;
  var url = request.url;
  var translatedMsg = translate('subscribeconfirm', title);
  if (window.confirm(translatedMsg)) {
    var existingFilterList = FilterListUtil.checkUrlForExistingFilterList(url);
    if (existingFilterList)
    {
      FilterListUtil.cached_subscriptions[existingFilterList.id].subscribed = true;
      CustomFilterListUploadUtil._updateExistingFilterList(existingFilterList);
    } else
    {
      if (/^https?\:\/\/[^\<]+$/.test(url))
      {
        CustomFilterListUploadUtil._performUpload(url, 'url:' + url, title);
      } else
      {
        alert(translate('failedtofetchfilter'));
      }
    }
  }

  sendResponse({});
});
// Represents the checkbox controlling subscription to a specific filter list,
// as well as the UI that goes along with it (e.g. status label and removal link.)
// Inputs:
//   filter_list:object - An entry from a filterListSections array.
//   filter_list_type:string - A key from filterListSections describing the section
//       where this checkbox will appear, e.g. 'language_filter_list'.
//   index:int - The position in the section where this checkbox should appear.
//   container:jQuery - The DOM element for the section in which this checkbox
//       should appear.
function CheckboxForFilterList(filter_list, filter_list_type, index, container) {
  this._container = container;
  this._filter_list = filter_list;
  this._filter_list_type = filter_list_type;
  this._id = this._filter_list_type + '_' + index;

  this._div = $('<div></div>').
      addClass('subscription').
      addClass(this._filter_list_type).
      attr('name', this._filter_list.id).
      css('display', this._filter_list_type === 'language_filter_list' ?
          (this._filter_list.subscribed ? 'block' : 'none') : 'block');

  this._check_box = $('<input />').
      attr('type', 'checkbox').
      attr('id', this._id).
      css('margin-left', '2px').
      prop('checked', this._filter_list.subscribed ? 'checked' : null).
      addClass('filter_list_control');

  this._label = $('<label></label>').
      text(this._filter_list.label || this._filter_list.title || this._filter_list.url).
      attr('title', this._filter_list.url).
      attr('for', this._id);

  this._link = $('<a></a>').
      text(this._filter_list.label || this._filter_list.title).
      css('margin-left', '6px').
      css('font-size', '10px').
      css('display', $('#btnShowLinks').prop('disabled') ? 'inline' : 'none').
      attr('target', '_blank').
      attr('class', 'linkToList').
      attr('href', this._filter_list.url);

  this._infospan = $('<span></span>').
      addClass('subscription_info').
      text(this._filter_list.subscribed && !this._filter_list.last_update ? (translate('fetchinglabel')) : '');

  this._remove_filter_list_label = this._filter_list.user_submitted ? $('<a>').
      css('font-size', '10px').
      css('display', this._filter_list.subscribed ? 'none' : 'inline').
      css('padding-left', '10px').
      attr('href', '#').
      addClass('remove_filter_list').
      text(translate('removefromlist')).
      click(function (event) {
          event.preventDefault();
          var $parent = $(this).parent();
          var id = $parent.attr('name');
          SubscriptionUtil.unsubscribe(id, true);
          $parent.remove();
        }) : null;
};

CheckboxForFilterList.prototype = {
    // Bind checkbox on change event to handle subscribing and unsubscribing to
    // different filter lists.
    _bindActions: function () {
        this._check_box.
            change(function () {
                var parent = $(this).parent();
                var checked = $(this).is(':checked');
                $('.remove_filter_list', parent).
                    css('display', checked ? 'none' : 'inline');
                var id = parent.attr('name');
                if (checked) {
                  $('.subscription_info', parent).text(translate('fetchinglabel'));
                  SubscriptionUtil.subscribe(id);
                  delete FilterListUtil.cached_subscriptions[id].unsubscribed;
                } else {
                  SubscriptionUtil.unsubscribe(id, false);
                  $('.subscription_info', parent).
                      text(translate('unsubscribedlabel'));
                  delete FilterListUtil.cached_subscriptions[id].subscribed;
                }
                //if the checkbox clicked is the malware
                //add a checkbox to for the user to indicate if they wish to be notified of blocked malware
                if (id && id === 'malware' && checked) {
                  addMalwareNotificationDiv();
                } else if (id && id === 'malware' && !checked) {
                  $('#malware-notification-message-div').remove();
                  chrome.storage.local.set({ 'malware-notification': false });
                }

                if (parent.attr('class').indexOf('language_filter_list') > -1)
                {
                  parent.toggle(500);
                  if (!checked)
                  {
                    var $this = $(this);
                    var index = $this.attr('id').split('_')[3];
                    var entry = filterListSections.language_filter_list.array[index];
                    if (!entry.hasOwnProperty('label'))
                    {
                      entry.label = translateIDs(id);
                    }

                    var option = new OptionForFilterList(entry, index);
                    LanguageSelectUtil.insertOption(option.get(), index);
                  }
                }
              });

        if (this._filter_list.user_submitted) {
          this._remove_filter_list_label.
              click(function (event) {
                  event.preventDefault();
                  var parent = $(this).parent();
                  var id = parent.attr('name');
                  SubscriptionUtil.unsubscribe(id, true);
                  parent.remove();
                });
        };
      },

    // Create the actual check box div and append in the container.
    // Inputs:
    //   isChecked:boolean - Flag that will indicate that this checkbox is checked by default.
    createCheckbox: function (isChecked) {
        this._div.
            append(this._check_box).
            append(this._label).
            append(this._link).
            append(this._infospan).
            append(this._remove_filter_list_label);

        this._container.append(this._div);

        this._bindActions();

        if (isChecked) {
          this._check_box.prop('checked', 'checked');
          this._check_box.trigger('change');
        }
      },
  };

// Represents the option for language filter lists inside the language select.
// Inputs:
//   filter_list:object - An entry from a filterListSections array.
//   index:int - The position in the language select where this option should appear.
function OptionForFilterList(filter_list, index) {
  this._filter_list = filter_list;
  this._index = index;

  this._option = $('<option>', {
      value: this._filter_list.id,
      text: this._filter_list.label,
    }).data('index', this._index);
};

OptionForFilterList.prototype = {
    // Returns the _option attribute.
    get: function () {
        return this._option;
      },
  };

// Contains all filter lists and their respective containers.
var filterListSections = {

};

// This class is in charge of creating the display per filter list type.
// Inputs:
//   filter_list_section:object - One of the objects in filterListSections.
//   filter_list_type:string - Will serve as the identifier for the corresponding filter list,
//      use the keys in filterListSections as its value.
function SectionHandler(filter_list_section, filter_list_type) {
  this._cached_subscriptions = filter_list_section.array;
  this._$section = filter_list_section.container;
  this._filter_list_type = filter_list_type;
};

SectionHandler.prototype = {
    // Organize each container for checkboxes.
    _organize: function () {
        for (var i = 0; i < this._cached_subscriptions.length; i++) {
          var filter_list = this._cached_subscriptions[i];
          var checkbox = new CheckboxForFilterList(filter_list, this._filter_list_type, i, this._$section);
          checkbox.createCheckbox();
        }
      },
    // Initialization call. Calls _organize to start displaying things.
    initSection: function () {
        this._organize();
      },
  };

// Utility class for filter lists.
function FilterListUtil() {
};

FilterListUtil.sortFilterListArrays = function () {
    for (var filter_list in filterListSections) {
      filterListSections[filter_list].array.sort(function (a, b) {
          return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
        });
    }
  };
// Prepare filterListSections.
// Inputs:
//    subs:object - Map for subscription lists taken from the background.
FilterListUtil.getFilterListType = function (filter_list) {
    var filter_list_type;
    if (filter_list.id === 'adblock_custom' ||
        filter_list.id === 'acceptable_ads' ||
        filter_list.id === 'easylist') {
      filter_list_type = 'adblock_filter_list';
    } else if (filter_list.id === 'easyprivacy' ||
        filter_list.id === 'antisocial' ||
        filter_list.id === 'malware' ||
        filter_list.id === 'annoyances' ||
        filter_list.id === 'warning_removal') {
      filter_list_type = 'other_filter_list';
    } else if (filter_list.user_submitted) {
      filter_list_type = 'custom_filter_list';
    } else {
      filter_list_type = 'language_filter_list';
    }

    return filter_list_type;
  };

FilterListUtil.prepareSubscriptions = function (subs) {
    FilterListUtil.cached_subscriptions = subs;
    for (var id in subs) {
      var entry = subs[id];
      // An exception is thrown if the translate msg isn't found.
      // Since, the user can enter custom filter URLs, translate will fail to find it.
      try {
        entry.label = translate('filter' + id);
      } catch (ex) {
        // Ignore error
        entry.label = '';
      }

      entry.id = id;
      var filter_list_type = FilterListUtil.getFilterListType(entry);
      filterListSections[filter_list_type].array.push(entry);
    }

    FilterListUtil.sortFilterListArrays();
  };
// Returns the subscription info object for the custom filter list specified by |url|,
// or undefined if that custom filter list does not exist.
// Inputs:
//   url:string - Url for uploaded custom filter list.
FilterListUtil.checkUrlForExistingFilterList = function (url) {
    var cached_subscriptions = FilterListUtil.cached_subscriptions;
    for (var id in cached_subscriptions) {
      if (url === cached_subscriptions[id].url) {
        return cached_subscriptions[id];
      }
    }

    return;
  };
// Updates info text for each filter list.
FilterListUtil.updateSubscriptionInfoAll = function () {
    var cached_subscriptions = FilterListUtil.cached_subscriptions;

    for (var id in cached_subscriptions) {

      var div = $("[name='" + id + "']");
      var subscription = cached_subscriptions[id];

      var infoLabel = $('.subscription_info', div);
      var text = infoLabel.text();

      var last_update = subscription.last_update;

      // If filter list is invalid, skip it.
      if (infoLabel.text() === translate('invalidListUrl')) {
        continue;
      }

      // If filter list is unsubscribed, skip it.
      if (infoLabel.text() === translate('unsubscribedlabel')) {
        continue;
      }


      if (subscription.last_update_failed_at) {
        if (subscription.user_submitted &&
            translate('failedtofetchfilter') === infoLabel.text()) {
          text = translate('invalidListUrl');
          $('input', div).attr('disabled', 'disabled');
        } else {
          text = translate('failedtofetchfilter');
        }
      } else if (last_update) {
        var how_long_ago = Date.now() - last_update;
        var seconds = Math.round(how_long_ago / 1000);
        var minutes = Math.round(seconds / 60);
        var hours = Math.round(minutes / 60);
        var days = Math.round(hours / 24);
        var text = '';
        if (seconds < 10)
            text += translate('updatedrightnow');
        else if (seconds < 60)
            text += translate('updatedsecondsago', [seconds]);
        else if (minutes === 1)
            text += translate('updatedminuteago');
        else if (minutes < 60)
            text += translate('updatedminutesago', [minutes]);
        else if (hours === 1)
            text += translate('updatedhourago');
        else if (hours < 24)
            text += translate('updatedhoursago', [hours]);
        else if (days === 1)
            text += translate('updateddayago');
        else
            text += translate('updateddaysago', [days]);
      }

      infoLabel.text(text);
    }
  };

// Update checkbox for the filter list according to it's current state.
// Inputs:
//    filter_list:object - Filter list that owns the check box to be updated.
//    id:String - Id of the filter list to be updated, also the name of the containing div in display.
FilterListUtil.updateCheckbox = function (filter_list, id) {

    var containing_div = $("div[name='" + id + "']");
    var checkbox = $(containing_div).find('input');
    // Check if subscribed and checkbox staus is equal, if not, update checkbox status according to subscribed status.
    if (checkbox.is(':checked') !== filter_list.subscribed) {
      checkbox.prop('checked', filter_list.subscribed ? true : null);
      // Force update current info label since status is already updated in the background.
      $('.subscription_info', containing_div).text(filter_list.subscribed ? translate('fetchinglabel') : translate('unsubscribedlabel'));
    }
  };

// Utility class for the language select.
function LanguageSelectUtil() {
};
// Insert option at specified index in the language select.
// Inputs:
//   option:OptionForFilterList - Option to be inserted.
//   index:int - Where to insert the option.
LanguageSelectUtil.insertOption = function (option, index) {
    var $language_select = $('#language_select');
    var options = $language_select.find('option');
    var i;
    for (i = 0; i < options.length; i++) {
      var list_option_index = options.eq(i).data('index');
      if (list_option_index && parseInt(list_option_index) > parseInt(index)) {
        break;
      }
    }

    if (options.eq(i).length > 0) {
      options.eq(i).before(option);
    } else {
      $language_select.append(option);
    }
  };
// Puts all unsubscribed language filter lists into the language select,
// and binds an onChange event on the select to subscribe to the selected
// filter list.
LanguageSelectUtil.init = function () {
    var language_filter_list_arr = filterListSections.language_filter_list.array;
    for (var i = 0; i < language_filter_list_arr.length; i++) {
      var language_filter_list = language_filter_list_arr[i];
      if (!language_filter_list.subscribed) {
        var option = new OptionForFilterList(language_filter_list, i);
        LanguageSelectUtil.insertOption(option.get(), i);
      }
    }

    $('#language_select').change(function () {
        var $this = $(this);
        var selected_option = $this.find(':selected');
        var index = $(selected_option).data('index');
        var entry = language_filter_list_arr[index];
        if (entry) {
          $this.find('option:first').prop('selected', 'selected');
          selected_option.remove();
          var $checkbox = $("[name='" + entry.id + "']").find('input');
          $checkbox.prop('checked', true);
          $checkbox.trigger('change');
        }
      });

  };
// Trigger change event to language select using one of the entries.
// Input:
//   filter_list:object - Filter list to select.
LanguageSelectUtil.triggerChange = function (filter_list) {
    var $language_select = $('#language_select');
    $language_select.val(filter_list.id);
    $language_select.trigger('change');
  };

// Utility class for Subscriptions.
function SubscriptionUtil() {
};
// Returns true if the user knows what they are doing, subscribing to many
// filter lists.
SubscriptionUtil.validateOverSubscription = function () {

    if ($('input:checkbox:checked.filter_list_control').length <= 6)
        return true;
    if (optionalSettings.show_advanced_options) {
      // In case of an advanced user, only warn once every 30 minutes, even
      // if the options page wasn't open all the time. 30 minutes = 1/48 day
      if ($.cookie('noOversubscriptionWarning')) {
        return true;
      } else {
        $.cookie('noOversubscriptionWarning', 'true', { expires: (1 / 48) });
      }
    }

    return confirm(translate('you_know_thats_a_bad_idea_right'));
  };
// Subscribe to the filter list with the given |id|.
// Input:
//   id:string - Id of the filter list to be subscribed to.
SubscriptionUtil.subscribe = function (id, title) {
    if (!SubscriptionUtil.validateOverSubscription()) {
      return;
    }

    var parameters = { id: id, title: title };
    if (FilterListUtil.cached_subscriptions[id] && FilterListUtil.cached_subscriptions[id].requiresList) {
      parameters.requires = FilterListUtil.cached_subscriptions[id].requiresList;
    }

    SubscriptionUtil._updateCacheValue(id);
    BG.subscribe(parameters);
    if (id === 'acceptable_ads') {
      $('#acceptable_ads_info').slideUp();
      $('#acceptable_ads').prop('checked', true);
    }
  };
// Unsubscribe to the filter list with the given |id|.
// Input:
//   id:string - Id of the filter list to be subscribed to.
//   del:boolean - Flag to indicate if filter list should be deleted in the background.
SubscriptionUtil.unsubscribe = function (id, del) {
    SubscriptionUtil._updateCacheValue(id);
    BG.unsubscribe({ id: id, del: del });
    if (id === 'acceptable_ads') {
      $('#acceptable_ads_info').slideDown();
      $('#acceptable_ads').prop('checked', false);
    }
  };
// Update the given filter list in the cached list.
// Input:
//   id:string - Id of the filter list to be updated.
SubscriptionUtil._updateCacheValue = function (id) {
    var sub = FilterListUtil.cached_subscriptions[id];
    if (sub) {
      delete sub.last_update_failed_at;
      delete sub.last_update;
    }
  };

// Utility class for custom filter list upload box.
function CustomFilterListUploadUtil() {
};
// Perform the subscribing part and creating checkbox for custom filter lists.
// Inputs:
//   url:string - Url for the custom filter list.
//   subscribe_to:string - The id of the custom filter list.
CustomFilterListUploadUtil._performUpload = function (url, subscribe_to, title) {
    SubscriptionUtil.subscribe(subscribe_to, title);
    var entry = {
        id: subscribe_to,
        url: url,
        subscribed: true,
        unsubscribe: true,
        user_submitted: true,
        label: title || '',
      };
    FilterListUtil.cached_subscriptions[entry.id] = entry;
    var custom_filter_list = filterListSections.custom_filter_list;
    var checkbox = new CheckboxForFilterList(entry, 'custom_filter_list', custom_filter_list.array.length, custom_filter_list.container);
    checkbox.createCheckbox(true);
  };
// When a user enters a URL in the custom filter list textbox for a known filter list,
// this method clicks the correct filter list checkbox/select option for him instead.
// Input:
//   existing_filter_list:object - Filter list whose URL was entered by the user.
CustomFilterListUploadUtil._updateExistingFilterList = function (existing_filter_list) {
    var containing_div = $("div[name='" + existing_filter_list.id + "']");
    if (containing_div.length < 1) {
      // If the checkbox does not exist but there is an existing filter list,
      // then recreate the checkbox
      var filter_list_type = FilterListUtil.getFilterListType(existing_filter_list);
      var filter_list_array = filterListSections[filter_list_type].array;
      var index = filter_list_array.indexOf(existing_filter_list);
      if (index < 0) {
        index = filter_list_array.length;
        filter_list_array.push(existing_filter_list);
      }

      var checkboxForFilterList = new CheckboxForFilterList(existing_filter_list, filter_list_type, index, filterListSections[filter_list_type].container);
      checkboxForFilterList.createCheckbox();
      containing_div = $("div[name='" + existing_filter_list.id + "']");
    }

    var checkbox = $(containing_div).find('input');

    if (!checkbox.is(':checked')) {
      if (checkbox.attr('id').indexOf('language_filter_list') >= 0) {
        LanguageSelectUtil.triggerChange(existing_filter_list);
      } else {
        checkbox.prop('checked', 'checked');
        checkbox.trigger('change');
      }
    }
  };
// Binds events for key press 'enter' and click for upload box.
CustomFilterListUploadUtil.bindControls = function () {
    $('#btnNewSubscriptionUrl').click(function () {
        var url = $('#txtNewSubscriptionUrl').val();
        var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
        if (abp_regex.test(url)) {
          url = url.match(abp_regex)[1]; // The part after 'location='.
          url = unescape(url);
        }

        url = url.trim();
        var subscribe_to = 'url:' + url;
        var existing_filter_list = FilterListUtil.checkUrlForExistingFilterList(url);

        if (existing_filter_list) {
          CustomFilterListUploadUtil._updateExistingFilterList(existing_filter_list);
        } else {
          if (/^https?\:\/\/[^\<]+$/.test(url)) {
            CustomFilterListUploadUtil._performUpload(url, subscribe_to);
          } else {
            alert(translate('failedtofetchfilter'));
          }
        }

        $('#txtNewSubscriptionUrl').val('');
      });

    // Pressing enter will add the list too.
    $('#txtNewSubscriptionUrl').keypress(function (event) {
        if (event.keyCode === 13) {
          event.preventDefault();
          $('#btnNewSubscriptionUrl').click();
        }
      });
  };

//add a checkbox to for the user to indicate if they wish to be notified of blocked malware
function addMalwareNotificationDiv() {

  if (document.getElementById('malware-notification-message-div'))
      return;//already exists, don't add it again.
  browser.storage.local.get('malware-notification', function (response) {
      var notify = response['malware-notification'];
      var newDiv = $('<div>').
          attr('id', 'malware-notification-message-div');
      var newInput = $('<input />').
          attr('type', 'checkbox').
          attr('id', 'malware-notification-message').
          css('margin-left', '25px').
          prop('checked', notify ? true : null);
      var newLabel = $('<label>').
          text(translate('malwarenotificationcheckboxmessage')).
          attr('for', 'malware-notification-message');
      var betaLabel = $('<label>').
          text(translate('betalabel')).
          attr('i18n', 'betalabel').
          css('padding-left', '5px');
      newDiv.append(newInput).append(newLabel).append(betaLabel);

      $("div[name='malware']").after(newDiv);

      $('#malware-notification-message').click(function () {
          var checked = $(this).is(':checked');
          chrome.storage.local.set({ 'malware-notification': checked });
        });
    });
}

var filtersInit = function () {
    // Retrieves list of filter lists from the background.
    var subs = BG.get_subscriptions_minus_text();
    // Initialize page using subscriptions from the background.
    // Copy from update subscription list + setsubscriptionlist

    filterListSections = {
        adblock_filter_list: {
            array: [],
            container: $('#ad_blocking_list'),
          },
        language_filter_list: {
            array: [],
            container: $('#language_list'),
          },
        other_filter_list: {
            array: [],
            container: $('#other_filter_lists'),
          },
        custom_filter_list: {
            array: [],
            container: $('#custom_filter_lists'),
          },
      };

    FilterListUtil.prepareSubscriptions(subs);

    for (var id in filterListSections) {
      var sectionHandler = new SectionHandler(filterListSections[id], id);
      sectionHandler.initSection();
    }

    LanguageSelectUtil.init();

    CustomFilterListUploadUtil.bindControls();

    //if the user is subscribed to malware, add the checkbox for notifications
    if (subs && subs['malware'] && subs['malware'].subscribed) {
      addMalwareNotificationDiv();
    }

    window.setInterval(function () {
        FilterListUtil.updateSubscriptionInfoAll();
      }, 5000);

    $('#btnUpdateNow').click(function () {
        $(this).attr('disabled', 'disabled');
        BG.update_subscriptions_now();
        setTimeout(function () {
            $('#btnUpdateNow').removeAttr('disabled');
          }, 300000); // Re-enable update button after 5 minutes.
      });

    $('#btnShowLinks').click(function () {
        $('.linkToList').fadeIn('slow');
        $('#btnShowLinks').remove();
      });

    browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request && request.command !== 'filters_updated') {
          return;
        } else if (!request) {
          return;
        }

        subs = BG.get_subscriptions_minus_text();
        var cached_subscriptions = FilterListUtil.cached_subscriptions;
        for (var id in cached_subscriptions) {
          var entry = subs[id];
          if (entry) {
            // Update checkbox according to the value of the subscribed field
            FilterListUtil.updateCheckbox(entry, id);
            // If entry is subscribed, update last_update_failed_at and last_update field
            if (entry.subscribed) {
              if (entry.last_update && entry.last_update_failed_at) {
                // If update is more recent than failed update, remove last_update_failed_at field,
                // otherwise, remove last_update field
                if (parseInt(entry.last_update) > parseInt(entry.last_update_failed_at)) {
                  delete subs[id].last_update_failed_at;
                } else {
                  delete subs[id].last_update;
                }
              }

              // Update last_update_failed_at and last_update field for the entry in cached subscriptions
              if (entry.last_update_failed_at) {
                cached_subscriptions[id].last_update_failed_at = entry.last_update_failed_at;
              } else if (entry.last_update) {
                cached_subscriptions[id].last_update = entry.last_update;
              }
            } else {
              SubscriptionUtil._updateCacheValue(id);
            }
          }
        }

        sendResponse({});
      });
  };

