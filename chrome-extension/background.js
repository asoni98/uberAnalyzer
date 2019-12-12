const RATE_LIMITING_ERROR = 429;
let errno = 0;

chrome.runtime.onInstalled.addListener(function (object) {
    chrome.tabs.create({url: "/options.html"}, function (tab) {
    });
});

//https://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data
const csvStringToArray = strData =>{
    const objPattern = new RegExp(("(\\,|\\r?\\n|\\r|^)(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^\\,\\r\\n]*))"),"gi");
    let arrMatches = null, arrData = [[]];
    while (arrMatches = objPattern.exec(strData)){
        if (arrMatches[1].length && arrMatches[1] !== ",")arrData.push([]);
        arrData[arrData.length - 1].push(arrMatches[2] ?
            arrMatches[2].replace(new RegExp( "\"\"", "g" ), "\"") :
            arrMatches[3]);
    }
    return arrData;
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function convertCSVToDict(csvArray) {
  // get headers
  const dict = []
  for (let row = 1; row < csvArray.length - 1; row++) {
    temp = {}
    for (let col = 0; col < csvArray[0].length; col++) {
      temp[csvArray[0][col]] = csvArray[row][col]
    }
    dict.push(temp)
  }
  return dict;
}

function access(object, func){
  let value = null;
  try {
    value = func(object)
  }
  catch(error) {
    return null;
  }
  return value;
}

function getAddress(address) {
  if (address == null || address == undefined) {
    return {street: null, city: null, state: null, zip: null, country: null}
  }
  let parts = address.split(', ');
  if (parts == null || parts == undefined) {
    parts = ['','','','']
  }
  let stateZip = (parts && parts.len >= 3) ? (parts[2].split(/\s+/)) : null;
  if (stateZip == null || stateZip == undefined) {
    stateZip = []
  }
  return {
    street: parts[0] || null,
    city: parts[1] || null,
    state: stateZip[0] || null,
    zip: stateZip[1] || null,
    country: parts[3] || null
  };
}

//get all the uuids and store them in local storage
async function uuidNetworkRequest(method, url, body = {}, cookie){
  let baseHeaders = {
    'accept': '*/*',
    'content-type': 'application/json',
    'cookie': cookie,
    'x-csrf-token': 'x'
  }
  const rawResponse = await fetch(url, {
    method: method,
    headers: baseHeaders,
    body: JSON.stringify(body)
  });
  const content = await rawResponse.json();
  return content
}

async function getStatementUUID(pageIndex = 1, cookie) {
  // get trip id's + promotional details from the uuid page. save times and trip id's on this page because they may be important for determining when driver is trying to pick up rides.
  // with trip id. can get all raw data.
  let url = 'https://partners.uber.com/p3/payments/api/fetchPayStatementsPaginated'
  let content
  let uuids = []
  let pageSize = 99;
  do {
    try {
      content = await uuidNetworkRequest('POST', url, {
        "pageIndex":pageIndex,
        "pageSize": pageSize,
        "pagination":
          {"totalPages": pageIndex, "pageNumber": pageIndex - 1, "pageSize": pageSize, "hasMoreData": true}},
          cookie)
    }
    catch (error) {
      console.log(error);
    }

    let hasMoreData = access(content, (cont) => cont.data.payStatementsPaginated.pagination.hasMoreData)
    if (!hasMoreData) {
      break;
    }
    const statements = access(content, (_content) => _content.data.payStatementsPaginated.statements);
    if (statements) {
      for (statement of statements) {
         uuids.push(statement.uuid || null);
      }
    }
    else {
      break; //no more statements
    }
    pageIndex += 1;
  } while (content.status = "success");


  // stop when
  /*
  {
    "status": "success",
    "data": {
        "payStatementsPaginatedEA": null,
        "payStatementsPaginated": {
            "statements": [],
            "pagination": {
                "totalPages": 0,
                "pageNumber": 0,
                "pageSize": 0,
                "hasMoreData": false
            },
            "isRollout": false
        }
    }
  }
  */

  return uuids;
}

async function processUUID(uuid, cookie){
  let tripCSVDict = await getStatementCSV(uuid, cookie);
  if (tripCSVDict == RATE_LIMITING_ERROR) {
    errno = RATE_LIMITING_ERROR;
    return RATE_LIMITING_ERROR;
  }
  else if (tripCSVDict == 502) {
    return 502
  }
  sendStatementData(tripCSVDict);

  buffer = []
  trips = {}
  tripIds = []
  for (let row of tripCSVDict.tripData) {
    let tripID = row["Trip_ID"] || null;
    promise = getTripData(tripID, cookie).then((data) => {
      trips[tripID] = data || null;
      tripIds.push(tripID || null);
    });
    buffer.push(promise);
  };
  await Promise.all(buffer);
  for (tripId of tripIds){
    sendTripData(trips[tripId]);
  }
  return trips;
}

async function getStatementCSV(uuid, cookie) {
  // console.log(`GETTING UUID: ${uuid}`)
  try {
    let url = `https://partners.uber.com/p3/payments/statements/${uuid}/csv`
    let query = {
      method: 'GET',
      "cookie": cookie,
      "accept": "*/*",
    }
    const rawResponse = await fetch(url, query);
    if (rawResponse.status == RATE_LIMITING_ERROR) {
      errno = RATE_LIMITING_ERROR;
      return RATE_LIMITING_ERROR
    }
    else if (rawResponse.status == 502) {
      return 502;
    }

    let content = await rawResponse.text();
    let array = csvStringToArray(content);
    let rowsAsDict = convertCSVToDict(array);

    let formattedDict = {
      statementId: uuid,
      tripData: [],
      tripIds: []
    }

    for (row of rowsAsDict) {
      formattedDict.tripData.push({
        "Trip_ID": row["Trip ID"] || null,
        "Date_Time": row["Date/Time"] || null,
        "Base_Fare": row["Base Fare"] || null,
        "Distance_Earnings": row["Distance"] || null,
        "Time_Earnings": row["Time"] || null,
        "Tip": row["Tip"] || null,
        "Instant_Pay_Fees": row["Instant Pay Fees"] || null,
        "Total": row["Total"] || null,
        "Type": row["Type"] || null, //UberX
        "Wait_Time": row["Wait Time"] || null
      });
      formattedDict.tripIds.push(row["Trip ID"] || null)
    }
    return formattedDict;
  }
  catch(error) {
    console.log("This Statement Doesn't Exist", error);
    return null;
  }
}

async function getTripData(tripUUID, cookie) {
  const url = 'https://partners.uber.com/p3/payments/trips/' + tripUUID
  const rawResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': ' text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
      'cookie': cookie
    }
  });
  const content = await rawResponse.text();
  // console.log(content);
  let doc = new DOMParser().parseFromString(content, "text/html");
  let jsonSingleQuotes = doc.scripts.namedItem("__REDUX_STATE__").text;

  let jsonDoubleQuotes;
  if (jsonSingleQuotes) {
    jsonDoubleQuotes = jsonSingleQuotes.split('\\u0022').join('"');
  }
  else {
    jsonDoubleQuotes = jsonSingleQuotes;
  }

  let response = JSON.parse(jsonDoubleQuotes);
  let trips = access(response, (resp) => resp.trips.tripsByUUID[tripUUID]);
  if (trips == null) {
    return trips;
  }

  let pickupAddress = getAddress(trips.pickupAddress);
  let dropoffAddress = getAddress(trips.dropoffAddress);

  const tripData = {
    "Trip_ID": tripUUID,
    "Driver_Breakdown": {
      "Base_Fare": access(trips, (trip) => trip.allPartiesBreakdowns[0].items[0].amount),
      "Distance_Earnings": access(trips, (trip) => trip.allPartiesBreakdowns[0].items[1].amount),
      "Time_Earnings": access(trips, (trip) => trip.allPartiesBreakdowns[0].items[2].amount),
      "Tip": access(trips, (trip) => trip.allPartiesBreakdowns[0].items[3].amount),
      "Total": access(trips, (trip) => trip.allPartiesBreakdowns[0].total),
    },
    "Rider_Breakdown": {
      "Rider_Price": access(trips, (trip) => trip.allPartiesBreakdowns[1].items[0].amount),
      "Tip": access(trips, (trip) => trip.allPartiesBreakdowns[1].items[1].amount),
      "Total": access(trips, (trip) => trip.allPartiesBreakdowns[1].total),
    },
    "Uber_Breakdown": {
      "Service_Fee": access(trips, (trip) => trip.allPartiesBreakdowns[2].items[0].amount),
      "Booking_Fee": access(trips, (trip) => trip.allPartiesBreakdowns[2].items[1].amount),
      "Total": access(trips, (trip) => trip.allPartiesBreakdowns[2].total),
    },
    "Other_Breakdown": {
      "Total": access(trips, (trip) => trip.allPartiesBreakdowns[3].total),
    },
    "Distance": trips.distance || null, //miles
    "Duration": trips.duration || null,//seconds
    "Pickup_Address": trips.pickupAddress || null,
    "Pickup_Address_Json": pickupAddress || null,
    "Dropoff_Address_Json": dropoffAddress || null,
    "Pickup_City": pickupAddress.city || null,
    "Pickup_State": pickupAddress.state || null,
    "Dropoff_City": dropoffAddress.city || null,
    "Dropoff_State": dropoffAddress.state || null,
    "Dropoff_Address": trips.dropoffAddress || null,
    "Dropoff_Time": trips.dropoffAt || null,
    "Formatted_Distance": trips.formattedDistance || null,
    "Formatted_Duration": trips.formattedDuration || null,
    "Pickup_Distance": trips.pickupDistance || null,
    "Pickup_Duration_In_Seconds": trips.pickupDurationInSeconds || null,
    "Requested_At": trips.requestAt || null, //milliseconds
  }
  return tripData;
}

// **************************** COOKIE START **********************************
function getCookies(domain, name, cookies) {
    chrome.cookies.get({"url": domain, "name": name}, function(cookie) {
        if (cookie) {
          cookies[name] = cookie.value;
        }
        else {
        cookies[name] = null;
      }
    });
}

async function getPartnerCookies(times) {
  cookies = {}
  getCookies("https://www.partners.uber.com", "csid", cookies);
  // getCookies("https://www.uber.com", "aam_uuid", cookies);
  getCookies("https://www.uber.com", "sid", cookies);
  await timeout(500);

  //check all cookies and if they don't exist display error
  if (cookies["csid"] && cookies["sid"]) {
    console.log("cookies", times, cookies);
    let partnerCookie = 'csid=' + cookies["csid"] + ';' + 'sid=' + cookies["sid"] + ';'
    return partnerCookie;
  }

  if (times < 10){
    return getPartnerCookies(times + 1);
  }
  else {
    return null;
  }
  // display message saying to log into uber again
}
// **************************** COOKIE END **********************************

statementData = []
function sendStatementData(data) {
  statementData.push(data);
  console.log("StatementData: ", data)

  if (data && userGlobal) {
    db.collection("drivers").doc(userGlobal.uid).collection("statement").doc(data["statementId"]).set(Object.assign({}, data))
    .then(function(result) {
      console.log("Added StatementData");
    })
    .catch(function(error) {
      console.log("Error Adding StatementData: ", error);
    });
  }
}

tripData = []
function sendTripData(data){
  tripData.push(data);
  console.log("TripData: ", data);

  if (data && userGlobal) {
    db.collection("drivers").doc(userGlobal.uid).collection("trips").doc(data["Trip_ID"]).set(data)
    .then(function(result) {
      console.log("Added TripData");
    })
    .catch(function(error) {
      console.log("Error Adding TripData: ", error);
    });
  }
}

async function getDone() {
  chrome.storage.local.get('done', function (isDone) {
    if (isDone == null || isDone == undefined) {
      window.done = 0;
      return 0;
    }
    else {
      window.done = isDone;
    }
    console.log("Done local storage value", isDone);
  })

  await timeout(1500);
  console.log("global done got", window.done);
}

async function setDone(value) {
  chrome.storage.local.set({'done': value}, function (returnval) {
    console.log("Finished. Set Done!");
  });
  window.done = value;

  await timeout(1000);
  console.log("global done set", window.done)
}

// let curOffset;
// chrome.storage.local.get('offset', function (curOffset) {
//   if (curOffset == null) {
//     curOffset = 0;
//   }
//   //do async operation to get csv's. show progress of trips
//
//    chrome.storage.local.set({'offset': curOffset + 25}, function () {
//     console.log('Value is set to ' + curOffset );
//  })
// });

// **************************** CODE START **********************************
async function start(partnerCookie) {
  let trips = [];

  let uuids = await getStatementUUID(1, partnerCookie); //(pageSize, numPages)
  console.log("Uuids:", uuids);

  statements = {};
  buffer = [];

  let index = 0;
  let quickCounter = 0;
  let size = 9;

  while (uuids && index < uuids.length && quickCounter < 3) {
    console.log("UUID: ", uuids[index], "Index", index);
    for (var i = index; i < (index + size) && i < uuids.length; i++) {
      promise = processUUID(uuids[i], partnerCookie).then((data) => {
        statements[uuids[i]] = data;
      });
      buffer.push(promise);
    }
    await Promise.all(buffer).then((data) => {});
    if (errno == RATE_LIMITING_ERROR) {
      console.log("RATE LIMITING ERROR! Retrying in 10 minutes", errno)
      await timeout(600000);  // await timeout(60000) //600,000 for 10 minutes or 3,600,000 for 60 minutes
      errno = 0;
    }
    else {
      await timeout(1000); //wait ten seconds for cool down
      index += size;
      quickCounter += 1;
    }
  }

  if (index >= uuids.length) { //|| quickCounter >= 1) {
    setDone(1);
    await timeout(1000);
  }
}

var config = {
  apiKey: "AIzaSyCa5O0ALQT9J_a-yzw9j2snyyx9ZsU8aK8",
  authDomain: "uber-analyzer.firebaseapp.com",
  databaseURL: "https://uber-analyzer.firebaseio.com",
  projectId: "uber-analyzer",
  storageBucket: "uber-analyzer.appspot.com",
  messagingSenderId: "642298059886",
  appId: "1:642298059886:web:4485e6379395f9944d9a7f",
  measurementId: "G-476JP41GNQ"
};
firebase.initializeApp(config);
var db = firebase.firestore();
let userGlobal;
window.done = 0;

/**
 * initApp handles setting up the Firebase context and registering
 * callbacks for the auth status.
 *
 * The core initialization is in firebase.App - this is the glue class
 * which stores configuration. We provide an app name here to allow
 * distinguishing multiple app instances.
 *
 * This method also registers a listener with firebase.auth().onAuthStateChanged.
 * This listener is called when the user is signed in or out, and that
 * is where we update the UI.
 *
 * When signed in, we also authenticate to the Firebase Realtime Database.
 */
async function initApp() {
  // Listen for auth state changes.

  firebase.auth().onAuthStateChanged(async function(user) {
    // firebase.auth()
    if (user) {
      userGlobal = user;
      let partnerCookie = await getPartnerCookies(1);
      await getDone();
      console.log("window done", window.done.done)
      if (window.done.done == 1) {
        return;
      }
      if (partnerCookie != null) {
        start(partnerCookie);
      }
      else {
        alert("Please go to partners.uber.com and log in! Then re-log into this application.");
      }
    }
    else {
      alert("Please sign into application with a google account! Click the UA app icon and log in.")
    }

    console.log('User state change detected from the Background script of the Chrome Extension:', user);
  });
}

window.onload = async function() {
  await initApp();
};




// ********************* UNUSED CODE ******************************************
async function getStatementHTMLData(statementUuid, cookie) { // Old
  const url = 'https://partners.uber.com/p3/payments/statements/' + statementUuid + '/print'
  const rawResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
      'cookie': cookie
    }
  });
  const content = await rawResponse.text();
  let doc = new DOMParser().parseFromString(content, "text/html");
  let jsonSingleQuotes = doc.scripts.namedItem("__REDUX_STATE__").text;
  let response = JSON.parse(jsonSingleQuotes.split('\\u0022').join('"'));

  // console.log(response);
}
