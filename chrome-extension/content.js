console.log("On content page");

//notify background to try again if it didn't work originally. Now the user might be logged in.

function getCsrfToken() {
  const re = new RegExp('"__CSRF_TOKEN__".*<\/script>', 'gm');
  const matches = document.documentElement.innerHTML.match(re);
  if (matches == null) {
    console.log("No CSRF Token");
    return null;
  }

  return matches[0].split('\\u0022')[1];
}

async function getTripsForClient() {
  const rawResponse = await fetch('https://riders.uber.com/api/getTripsForClient', {
    method: 'POST',
    headers: {
      'content-type':  'application/json',
      'x-csrf-token': getCsrfToken()
    },
    body: JSON.stringify({"limit":10,"offset":"0"})
  });
  const content = await rawResponse.json();
  console.log(content);
}
