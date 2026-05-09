var selectedDateTimes = [];

var dates = [];

var date = new Date();
var currentRealDate = new Date();

function previousMonth() {
    if(date.getMonth() != currentRealDate.getMonth()){
        date.setMonth(date.getMonth() - 1);
        getData();
    }
}

function nextMonth() {
    date.setMonth(date.getMonth() + 1);
    getData();
}


function redraw() {
    $(module_id + ' table#calendar tbody').empty();
    var firstDay = getFirstDayOfMonth(date.getMonth(), date.getFullYear());
    var daysInMonth = getDaysInMonth(date.getMonth(), date.getFullYear());

    $(module_id + ' #monthHeading').text(getMonthName(date.getMonth(), date.getFullYear()) + ' - ' + date.getFullYear());

    var day = 0;

    for (var x = 0; x <= Math.ceil(daysInMonth / 7); x++) {
        if (day >= daysInMonth) {
            break;
        }
        var row = $('<tr/>');
        for (var y = 0; y < 7; y++) {
            if ((day >= daysInMonth) || (day === 0 && x === 0 && y < firstDay - 1) || (firstDay == 0 && y < 6 && x == 0)) {
                $('<td/>').appendTo(row);
                continue;
            }
            day++;
            var availableClass = 'unavailable';
            for (var i = 0; i < dates.length; i++) {
                var currentDate = dates[i];
                var currentRealDate = new Date();

                if (currentDate.date.day === day && currentDate.date.month === date.getMonth() + 1 && currentDate.date.year === date.getFullYear() && currentDate.times.length > 0) {
                    if(networkID == 7) {
                        // F&C
                        if(currentDate.date.month === currentRealDate.getMonth() + 1 && currentDate.date.day < currentRealDate.getDate()){

                        } else {
                            availableClass = 'available';
                            break;
                        }
                    } else {
                        if(currentDate.date.month === currentRealDate.getMonth() + 1 && currentDate.date.day <= currentRealDate.getDate()){

                        } else {
                            availableClass = 'available';
                            break;
                        }
                    }
                }
            }

            $('<td/>').addClass('day ' + availableClass).data('day', day).data('month', date.getMonth()).data('year', date.getFullYear()).text(day).appendTo(row).click(clickCell);


        }
        $(module_id + ' table#calendar tbody').append(row);
    }

}

function getDaysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(month, year) {
    var d = new Date(year, month, 1);

    return d.getDay();
}

function getDayName(day, month, year) {
    var d = new Date(year, month - 1, day);
    var weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    return weekday[d.getDay()];
}

function getMonthName(month, year) {
    var d = new Date(year, month, 1);
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return months[d.getMonth()];
}

$(window).click(function() {
    hideDropdown();
});

function clickCell(event) {
    event.stopPropagation();
    var thisDay = $(this).data('day');
    var thisMonth = $(this).data('month') + 1;
    var thisYear = $(this).data('year');
    var thisData = {};
    var today = new Date();
    var iamToday;

    $('<div class="dismissFilm" onclick="event.stopPropagation();" style="position:absolute;top:0px;bottom:0px;left:0px;right:0px;"></div>').appendTo('body');

    $.each(dates, function (index, data) {
        if (data.date.day === thisDay && data.date.month === thisMonth && data.date.year === thisYear) {
            thisData = data;

            if(networkID == 7) {
                if (today.getDate() == thisDay && (today.getMonth() + 1) == thisMonth && today.getFullYear() == thisYear) {
                    iamToday = true;
                    today.setHours(today.getHours() + 1);
                }
            }
        }
    });

    if (!jQuery.isEmptyObject(thisData) && $(this).hasClass('available')) {
        var timeSlots = $('<div/>').addClass('timeSlots clearfix');

        $.each(thisData.times, function (index, time) {
            var timeStart = time.start.hour + ":" + time.start.minute;
            var timeEnd = time.end.hour + ":" + time.end.minute;
            var timeIntervals = makeTimeIntervals(timeStart, timeEnd, 30);

            $.each(timeIntervals, function (index, interval) {
                for (var i = 0; i < selectedDateTimes.length; i++) {
                    var dateTime = selectedDateTimes[i];

                    if (dateTime.day == thisDay && dateTime.month == thisMonth && dateTime.year == thisYear && dateTime.time == interval) {
                        var spanClass = 'timeSelected';
                        break;
                    } else {
                        var spanClass = '';
                    }
                }

                var slotHour = interval.substring(0, interval.indexOf(":"));
                var slotMinute = interval.substring(interval.indexOf(":") + 1);
                var disabled;

                if(networkID == 7 && iamToday) {
                    var hour = today.getHours();
                    var minute = today.getMinutes();
                    if (slotHour < hour) {
                        disabled = true;
                    } else if (slotHour == hour && slotMinute <= minute) {
                        disabled = true;
                    }
                }

                if (disabled) {
                    $('<span/>').addClass('col-md-4 col-sm-4 col-xs-4 timeSlot disabled ' + index + ' ' + spanClass).html(interval).data('time', interval).click(selectTime).appendTo(timeSlots);
                } else {
                    $('<span/>').addClass('col-md-4 col-sm-4 col-xs-4 timeSlot ' + index + ' ' + spanClass).html(interval).data('time', interval).click(selectTime).appendTo(timeSlots);
                }
            });
        });
        timeSlots.append('<span class="close-timeslots col-md-12 text-center"><i class="fa fa-arrow-up"></i> Hide</span>');

        $(this).toggleClass('cellSelected');
        $(module_id + ' .cellSelected').not(this).removeClass('cellSelected');
        $(module_id + ' .timesPopup').not('.timesPopup.' + thisDay).remove();

        if ($(this).hasClass('cellSelected')) {
            var a = $('<div/>').addClass('timesPopup ' + thisDay);
            var b = $('<div/>').addClass('slidedown');
            $(timeSlots).appendTo(b);
            $(b).appendTo(a);
            $(a).appendTo(this);


            $(module_id + ' .slidedown').hide();
            $(module_id + ' .slidedown').slideDown("normal");
        } else {
            hideDropdown();
        }

    } else {
        hideDropdown();
    }

}

function selectTime(e) {
    e.stopPropagation();
    var disabled = $(e.target).hasClass('disabled');

    if (!disabled) {
        // check and store date and time value in an array of objects
        var thisDay = $(this).closest('.day').data('day');
        var thisMonth = $(this).closest('.day').data('month') + 1;
        var thisYear = $(this).closest('.day').data('year');
        var thisTime = $(this).data('time');

        for (var i = 0; i < selectedDateTimes.length; i++) {
            var dateTime = selectedDateTimes[i];

            if (dateTime.day == thisDay && dateTime.month == thisMonth && dateTime.year == thisYear && dateTime.time == thisTime) {
                selectedDateTimes.splice(i, 1);
                $(module_id + ' #preferred_times').val(JSON.stringify(selectedDateTimes));
                $(this).removeClass('timeSelected');
                drawPreferredTimes(thisDay, thisMonth, thisYear, thisTime);
                return;
            }
        }

        if (networkID != 7) {
            // Limitting time slots to 3
            if (selectedDateTimes.length <= 2) {
                selectedDateTimes.push({'day': thisDay, 'month': thisMonth, 'year': thisYear, 'time': thisTime});
                $(module_id + ' #preferred_times').val(JSON.stringify(selectedDateTimes));
                $(module_id + ' .selectedDateHolder').empty();
                var displayDates = [];

                drawPreferredTimes(thisDay, thisMonth, thisYear, thisTime);

                // display selected tick depending on data
                if ($(this).hasClass('timeSelected')) {
                    $(this).removeClass('timeSelected');
                } else {
                    $(this).addClass('timeSelected');
                }
            } else {
                displayAlert('#warning-alert');
            }
        } else {
            selectedDateTimes.push({'day': thisDay, 'month': thisMonth, 'year': thisYear, 'time': thisTime});
            $(module_id + ' #preferred_times').val(JSON.stringify(selectedDateTimes));
            $(module_id + ' .selectedDateHolder').empty();
            var displayDates = [];

            drawPreferredTimes(thisDay, thisMonth, thisYear, thisTime);

            // display selected tick depending on data
            if ($(this).hasClass('timeSelected')) {
                $(this).removeClass('timeSelected');
            } else {
                $(this).addClass('timeSelected');
            }
        }
    }

}

function drawPreferredTimes() {
    var appendClass = '.selectedDateHolder';
    var classExists = '';
    $(module_id + ' .selectedDateHolder').empty();
    $.each(selectedDateTimes, function (index, date) {
        classExists = '';
        if ($(module_id + ' .selectedDateHolder p').length > 0) {
            $.each($('.selectedDateHolder p'), function (i, p) {
                if ($(p).hasClass(date.day + '_' + date.month + '_' + date.year)) {
                    classExists = date.day + '_' + date.month + '_' + date.year;
                }
            });
            if (classExists != '') {
                $('<small/>').addClass('agentColourTwoText').text(date.time + ", ").appendTo('.' + classExists);
            } else {
                var dayName = getDayName(date.day, date.month, date.year);
                var monthName = getMonthName(date.month-1, date.year);
                $('<p/>').addClass(date.day + '_' + date.month + '_' + date.year).html("<p class='pref_date'>" + dayName + ", " + date.day + " " + monthName + "</p><small class='agentColourTwoText'>" + date.time + ", </small>").appendTo('.selectedDateHolder');
            }
        } else {
            var dayName = getDayName(date.day, date.month, date.year);
            var monthName = getMonthName(date.month-1, date.year);
            $('<p/>').addClass(date.day + '_' + date.month + '_' + date.year).html("<p class='pref_date'>" + dayName + ", " + date.day + " " + monthName + "</p><small class='agentColourTwoText'>" + date.time + ", </small>").appendTo('.selectedDateHolder');
        }
    });
}

function hideDropdown() {
    $('.dismissFilm').remove();
    $('.cellSelected').removeClass('cellSelected');
    $('.slidedown').slideUp("normal", function () {
        $('.timesPopup').remove();
    });
}

function makeTimeIntervals(startTime, endTime, increment) {
    startTime = startTime.toString().split(':');
    endTime = endTime.toString().split(':');
    increment = parseInt(increment, 10);

    var pad = function (n) {
            return (n < 10) ? '0' + n.toString() : n;
        },
        startHr = parseInt(startTime[0], 10),
        startMin = parseInt(startTime[1], 10),
        endHr = parseInt(endTime[0], 10),
        endMin = parseInt(endTime[1], 10),
        currentHr = startHr,
        currentMin = startMin,
        previous = currentHr + ':' + pad(currentMin),
        current = '',
        r = [];

    do {
        currentMin += increment;
        if ((currentMin % 60) === 0 || currentMin > 60) {
            currentMin = (currentMin === 60) ? 0 : currentMin - 60;
            currentHr += 1;
        }
        current = currentHr + ':' + pad(currentMin);
        r.push(previous);
        previous = current;
    } while (currentHr !== endHr);

    return r;
};

// Alert
function displayAlert(i) {
    $(i).slideDown(500);
    $(i).delay(3000).slideUp(500);
}

$(function () {
    $(module_id + ' #prevMonth').click(previousMonth);
    $(module_id + ' #nextMonth').click(nextMonth);
    getData();
});
