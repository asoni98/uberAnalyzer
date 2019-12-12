function sortByKey(obj) {
  var keysArray = []
  var sorted = Object.keys(obj).sort((a,b) => (a-b)).map(
    function(k)
    {
      keysArray.push(k)
      return obj[k]
    });

  return {'labels': keysArray, 'data': sorted};
}

//group data by week
function groupDataByWeek(data)
{
    let byWeek = {};
    //value, index, array
    for (var i = 0; i < data.length; i++) {
      let d = new Date(parseFloat(access(data[i], d => d.Dropoff_Time))*1000);
      d = Math.floor(d.getTime()/(1000*60*60*24*7));
      byWeek[d] = byWeek[d]||[];
      byWeek[d].push(data[i]);
    }

    return sortByKey(byWeek);
}

function groupDataByHoursWorkedPerWeek(data)
{
  let byWeek = groupDataByWeek(data);
  let labelsLen = byWeek['labels'].length;
  let byHours = {}

  for (var i = 0; i < labelsLen; i++) {
    let weekData = byWeek['data'][i]
    let secondsDrivenPerWeek = 0
    for (var j = 0; j < weekData.length; j++) {
      secondsDrivenPerWeek += weekData[j].Duration
    }
    let hoursDriven = Math.ceil(secondsDrivenPerWeek/3600)
    byHours[hoursDriven] = byHours[hoursDriven]||[];
    byHours[hoursDriven] = byHours[hoursDriven].concat(weekData);
  }

  return sortByKey(byHours);
}

//group data by length of trip
// 0 to 1.6 mile, 1.6 to 5 miles, 5 to 10 miles, 10 miles to 30 miles, 30+ miles
function groupDataByTripLength(data, tripLengths = [1.6, 5.0, 10.0, 30.0]) {
    let byTripLength = {}
    tripLengths.push(Infinity); //max length

    for (var i = 0; i < data.length; i++) {
      let d = parseFloat(access(data[i], d => d.Distance));
      for (var j = 0; j < tripLengths.length; j++) {
        if (d < tripLengths[j]) {
          byTripLength[tripLengths[j]] = byTripLength[tripLengths[j]]||[]
          byTripLength[tripLengths[j]].push(data[i])
          break;
        }
      }
    }

    return sortByKey(byTripLength);
}

function groupDataByTimeDay(data, timeDay = [6, 14, 22]) { //6 am to 2 pm, 2 pm to 10 pm, 10 pm to 6 am
  let byTimeDay = {}

  for (var i = 0; i < data.length; i++) {
    let d = parseFloat(access(data[i], d => d.Dropoff_Time)) * 1000;
    let trip_date = new Date(d);
    let trip_hour = trip_date.getHours()
    for (var j = 0; j < timeDay.length; j++) {
      if (trip_hour < timeDay[j]) {
        byTimeDay[timeDay[j]] = byTimeDay[timeDay[j]]||[]
        byTimeDay[timeDay[j]].push(data[i])
        break;
      }
    }
  }

  return sortByKey(byTimeDay);
}

function groupDataByYear(data) {
  let byYear = {}

  for (var i = 0; i < data.length; i++) {
    let d = parseFloat(access(data[i], d => d.Dropoff_Time)) * 1000;
    let trip_date = new Date(d);
    let trip_year = trip_date.getYear()
    byYear[trip_year] = byYear[trip_year]||[]
    byYear[trip_year].push(data[i])
  }
  let years = Object.keys(byYear).map((x) => parseInt(x) + 1900)
  if (years[0] < 70) {
    return {'labels': Object.keys(byYear).map((x) => parseInt(x) + 1900).slice(1), 'data': sortByKey(byYear)['data'].slice(1)};
  }

  return {'labels': Object.keys(byYear).map((x) => parseInt(x) + 1900), 'data': sortByKey(byYear)['data']};
}


function groupByCity(data) {
  let byCity = {}

  for (var i = 0; i < data.length; i++) {
    let pickup_city = data[i].Pickup_City;
    byCity[pickup_city] = byCity[pickup_city]||[]
    byCity[pickup_city].push(data[i])
  }

  return sortByKey(byCity);
}

function variableCost(data, gasPrice, mpg) {
  let tripsCost = 0;
  let tripsDistance = 0;
  for (var i = 0; i < data.length; i++) {
    tripsDistance += data[i].Distance;
    tripsCost += (data[i].Distance / mpg) * gasPrice;
  }
  return {"cost": tripsCost, "distance": tripsDistance};
}

function averageProfitTrips(data, gasPrice, mpg) {
  let tripInformation = variableCost(data, gasPrice, mpg)
  return (sumDriverTotal(data) - tripInformation.cost) / tripInformation.distance
}

// do every length by mile from 0 to 120 miles.
// only accounting for gas cost and not including wait time to get this short of a trip.
function averageProfitByLabel(labeledData, gasPrice, mpg) { //time in minutes
  let labeledDataLengths = labeledData['labels']

  let averageProfit = []

  for (var i = 0; i < labeledData['data'].length; i++) {
    averageProfit.push(averageProfitTrips(labeledData['data'][i], gasPrice, mpg))
  }
  return {'labels': labeledDataLengths, 'data': averageProfit}
}

function averageProfitByTripLength(data, gasPrice, mpg) {
  let byTripLength = groupDataByTripLength(data, [1,2,3,4,5,6,7,8,9,10,11,15,20,25,30,35,40,45,50,55,60,65]);
  console.log("SORTED KEY", byTripLength.labels)
  return averageProfitByLabel(byTripLength, gasPrice, mpg);
}

function averageProfitByTimeDayByTripLength(data, gasPrice, mpg) {
  let byTimeDay = groupDataByTimeDay(data, [4, 12, 20]);

  let timeLength = []
  for (var i = 0; i < byTimeDay['labels'].length; i++) {
    let timeData = byTimeDay['data'][i]
    console.log("Time Day", byTimeDay['labels'][i])
    timeLength.push(averageProfitByTripLength(timeData, gasPrice, mpg)['data'])
  }

  return {'labels': [1,2,3,4,5,6,7,8,9,10,11,15,20,25,30,35,40,45,50,55,60,65], 'data': timeLength}
}
let gasPrice = 2.573
let mpg = 30
console.log("REAL", averageProfitByTimeDayByTripLength(data, gasPrice, mpg))

function averageProfitPerTripByCity(data, gasPrice, mpg) {
  let byCity = groupByCity(data)
  return averageProfitByLabel(byCity, gasPrice, mpg);
}

function averageProfitPerTripByHoursWorkedPerWeek(data, gasPrice, mpg) {
  let byHoursWorked = groupDataByHoursWorkedPerWeek(data);
  return averageProfitByLabel(byHoursWorked, gasPrice, mpg);
}

// function averageTakeRateByYear(data) {
//   yearGroupedData = groupDataByYear(data)
//   totalTakeRateByYear = {}
//
//   for (var i = 0; i < yearGroupedData.labels.length; i++) {
//     totalTakeRateByYear[yearGroupedData.labels[i]] = computeUberShareTotal(yearGroupedData.data[i]);
//     console.log(yearGroupedData.data[i].length)
//   }
//
//   return sortByKey(totalTakeRateByYear);
// }
// console.log("Average Take Rate By Year", averageTakeRateByYear(data));


// function piePercentagesTakeRateFares(data) {
//   uberShare = computeUberShareByTrip(data)['data'];
//   farePercentages = [10, 20, 30, 40, 50]
//
//   for (var i = 0; i < array.length; i++) {
//     array[i]
//   }
// }


console.log("Average Profit Made By Trip Length", averageProfitByTripLength(data, gasPrice, mpg))
// console.log("Average Profit Made By Time Day", averageProfitByTimeDayByTripLength(data, gasPrice, mpg))
// console.log("Average Profit Per Trip By Hours Worked Per Week", averageProfitPerTripByHoursWorkedPerWeek(data, gasPrice, mpg))
// console.log("Average Profit Per Trip By City", averageProfitPerTripByCity(data, gasPrice, mpg))

function uberTakeRateByLength(data) {
  let byTripLength = groupDataByTripLength(data, [1,2,3,4,5,6,7,8,9,10,11,15,20,25,30,35,40,45,50,55,60,65]) // Array.from(Array(120).keys()).slice(1)

  let tripLengths = byTripLength['labels']
  let takeRateByLength = []

  for (var i = 0; i < byTripLength['data'].length; i++) {
    takeRateByLength.push(computeUberShareTotal(byTripLength['data'][i]))
  }
  return {'labels': tripLengths, 'data': takeRateByLength}
}

// console.log("Take Rates By Length", uberTakeRateByLength(data));

function access(object, func) {
  let value = null;
  try {
    value = func(object)
    if (value) {
      return value;
    }
    else {
      return 0;
    }
  }
  catch(error) {
    return 0;
  }
}

function sumRiderTotal(data) {
  let riderPriceSum = 0;
  for (var i = 0; i < data.length; i++) {
    let riderTip = parseFloat(access(data[i], d => d.Rider_Breakdown.Tip));
    let riderTotal = parseFloat(access(data[i], d => d.Rider_Breakdown.Total)); //get rid of TIP!!!!!

    riderPriceSum += (riderTotal - parseFloat(access(data[i], d => d.Driver_Breakdown.Tip)))
  }
  return riderPriceSum;
}
// console.log("Rider Total Price", sumRiderTotal(data))

function sumDriverTotal(data) {
  let driverTotalSum = 0;
  for (var i = 0; i < data.length; i++) {
    driverTotalSum += parseFloat(access(data[i], d => d.Driver_Breakdown.Total)) - parseFloat(access(data[i], d => d.Driver_Breakdown.Tip));;
  }
  return driverTotalSum;
}
// console.log("Driver Total Sum", sumDriverTotal(data));

function sumUberTotal(data) {
  let uberSum = 0;
  for (var i = 0; i < data.length; i++) {
    uberSum += parseFloat(access(data[i], d => d.Uber_Breakdown.Total));
  }
  return uberSum;
}
// console.log("Uber Total", sumUberTotal(data))


function sumOtherTotal(data) {
  let otherSum = 0;
  for (var i = 0; i < data.length; i++) {
    otherSum += parseFloat(access(data[i], d => d.Other_Breakdown.Total));
  }
  return otherSum;
}
// console.log("Other Total", sumOtherTotal(data))

/* Take Rate Functions  */

//Not including rider tips
function computeDriverShareTotal(data) {
  //calculates (total money driver made / total money passengers paid)
  return sumDriverTotal(data) / sumRiderTotal(data);
}
// console.log("Driver Share Total", computeDriverShareTotal(data))

//Not including rider tips
function computeDriverShareByTrip(data) {
  //averages (total money driver made on trip / total money passengers paid) over all trips
  let totalShare = 0;
  let driverShareByTrip = []

  for (var i = 0; i < data.length; i++) {
    let driverShare = computeDriverShareTotal([data[i]]);
    driverShareByTrip.push(driverShare)
    totalShare += driverShare || 0;
  }
  return {'average': totalShare / data.length, 'data': driverShareByTrip};
}
// console.log("Driver Share Averaged By Trip", computeDriverShareByTrip(data));

//Not including rider tips
function computeUberShareTotal(data) {
  //calculates (total money uber made / total money passengers paid)
  return sumUberTotal(data) / sumRiderTotal(data)
}
// console.log("Uber Share Total", computeUberShareTotal(data));


function computeUberShareByTrip(data) {
  //averages (total money uber made on trip / total money passengers paid) over all trips

  let totalShare = 0;
  let uberShareByTrip = []

  for (var i = 0; i < data.length; i++) {
    let uberShare = computeUberShareTotal([data[i]]);
    uberShareByTrip.push(uberShare)
    totalShare += uberShare || 0;
  }
  // console.log("Uber Share By Trip", uberShareByTrip)
  return {'average': totalShare / data.length, 'data': uberShareByTrip}
}
// console.log("Uber Averaged by trip", computeUberShareByTrip(data));

function computeOtherShareTotal(data) {
  let otherMadeTotal = sumOtherTotal(data)
  let passengerPaidTotal = sumRiderTotal(data);

  return otherMadeTotal / passengerPaidTotal
}
// console.log("Other Share Total", computeOtherShareTotal(data))

function computeOtherShareByTrip(data) {
  //averages (total money uber made on trip / total money passengers paid) over all trips

  let totalShare = 0;
  let otherShareByTrip = []

  for (var i = 0; i < data.length; i++) {
    let otherShare = computeOtherShareTotal([data[i]]);
    otherShareByTrip.push(otherShare)
    totalShare += otherShare || 0;
  }
  // console.log("Uber Share By Trip", uberShareByTrip)
  return {'average': totalShare / data.length, 'data': otherShareByTrip}
}
// console.log("Other Averaged by trip", computeOtherShareByTrip(data));


// export {
//   averageProfitByTripLength,
//   averageProfitByTimeDayByTripLength,
//   averageProfitPerTripByHoursWorkedPerWeek,
//   averageProfitPerTripByCity,
//   uberTakeRateByLength,
//   sumRiderTotal,
//   sumDriverTotal,
//   sumUberTotal,
//   sumOtherTotal,
//   computeDriverShareTotal,
//   computeDriverShareByTrip,
//   computeUberShareTotal,
//   computeUberShareByTrip,
//   computeOtherShareTotal,
//   computeOtherShareByTrip
// }
