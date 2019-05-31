
// Let's start by grabbing the URL query parameters and setting some
// variables.

// Grab the call number and location from the URL query string.
var urlParams = new URLSearchParams(window.location.search);
callnumber = urlParams.get('callnumber');
libLocation = urlParams.get('location');

// As of May 2019, Primo VE replaces & in the query string with &amp;
// Catch that and fix it, if needed.
// If so, fix it.
if (libLocation == null) {
  libLocation = urlParams.get('amp;location');
}

// Set the base URLs for the data files and map files.
// Map files have the format: [floor number].svg
var mapUrl = "https://www.law.georgetown.edu/wp-content/themes/georgetownlaw/georgetownlaw/images/library-maps/ebw-";
// Data file names have the format: data-[location code].json
var dataUrl = "https://www.law.georgetown.edu/wp-content/themes/georgetownlaw/georgetownlaw/images/library-maps/";

// Set the error output messages.
var missingCallNumberError = "<h1>Error</h1><p>No call number provided.</p>";
var missingLocationError = "<h1>Error</h1><p>No location provided.</p>";
var nothingFoundError = "";
// var nothingFoundError = "<h2>Error</h2><p>No matches found for call number " + callnumber + " and location " + libLocation + ".</p>";
var dataLoadError = "<h1>Error</h1><p>A problem was encountered with loading stack data for location "
  + libLocation + ".</p>";
var multipleFloorsError = "<p>We could not determine which floor map to display for this location and call number. Please contact the Circulation Desk in the second floor atrium for assistance.</p>";

// ------------------------------------------------------------------

// Now we're ready to get to work.
// Both a location and a valid call number need to be set in order to proceed.
if(
  (libLocation != null && libLocation.length)
) {
  if ((callnumber != null && callnumber.length)){

    // If we made it this far, then we've got a location and call number
    // to work with.

    // Create a new locCallClass instance.
    var loc = new locCallClass;

    // Set an array to hold matching ranges.
    var ranges = [];
    var floor = 0; // Starting value for the floor.

    // Load the stack data for this location.
    // This function will call additional functions as it works through
    // the stack data in this order:
    //    loadStackData: Load the data file for this location)
    //      findMatches: Find ranges in this location for the call number
    //        loadMap: Load the map file with the range(s)
    //          highlight: Higlight and circle the ranges on the map.
    loadStackData(libLocation);

  } else {
    // No call number. Show an error message.
    var div = document.getElementById('mapit-output');
    div.innerHTML += missingCallNumberError;
  }
} else {
  // No location. Show an error message.
  var div = document.getElementById('mapit-output');
  div.innerHTML += missingLocationError;
}

// ------------------------------------------------------------------

function loadStackData(libLocation) {
  // Load the stack data for this location.
  var path = dataUrl + 'data-' + libLocation.toLowerCase() + ".json";
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = function() {
      if (httpRequest.readyState === 4) {
          if (httpRequest.status === 200) {
            var location_data = JSON.parse(httpRequest.responseText);

            // Look for matches in the data.
            findMatches(location_data);
          } else {
            var div = document.getElementById('mapit-output');
            div.innerHTML += dataLoadError;
            throw new Error("Could not load stack data for location: " + libLocation);
          }
      }
  };
  httpRequest.open('GET', path);
  httpRequest.send();
}

// ------------------------------------------------------------------

function findMatches(location_data) {

  var stack_data = location_data.ranges;
  var allFloors = []; // Create empty array for all floors at this location.
  var floors = []; // Create an empty array for the floors of matching ranges.

  // Loop through the call number data.
  for(var i = 0; i < stack_data.length; i++) {

    var stack = stack_data[i];

    if (allFloors.indexOf(stack.floor) === -1) {
      allFloors.push(stack.floor);
    }

    // Compare the incoming call number to the ranges.
    if(loc.isBetween(stack.lc_from, stack.lc_to, callnumber)) {

      // Add the floor is it's not already in the array.
      if (floors.indexOf(stack.floor) === -1) {
        floors.push(stack.floor);
      }

      // Add this stack to the array of matching ranges.
      ranges.push(stack);
    }
  }

  // If no ranges were found, send all floors for the location.
  if (ranges.length === 0) {
    floors = allFloors;
  }

  loadMap(ranges, floors, location_data.name, location_data.description, location_data.showRanges);
}

// ------------------------------------------------------------------

function loadMap(ranges, floors, locationName, locationDescription, showRanges) {

    // Start assembline the text output string.
    var div = document.getElementById('mapit-output');
    var outputString = '<h1>Williams Library';

    // If there's just one floor, append it to the heading.
    if (floors.length === 1) {
      outputString += ', Floor ' + floors[0];
    }

    // Shw call number and location name.
    outputString += '</h1>\n'
      + '<p>Call Number: ' + callnumber + '<br />\n'
      + 'Location: ' + locationName + '<br />\n';

    // We don't want to show the "Ranges found" note for all locations.
    // Look for the showRanges JSON variable to check.
    if (showRanges) {
      if (ranges.length > 1) {
        outputString += 'Ranges found: ';
      } else {
        outputString += 'Range found: ';
      }
    }

    // For now we're only capable of showing a single map. So throw an
    // error if multiple floors were returned.
    if(floors.length > 1) {

      // Show error output to the user.
      div.innerHTML += outputString;
      var div = document.getElementById('mapit-output');
      div.innerHTML += multipleFloorsError;

      throw new Error("Call number may appear on multiple floors for this location.");
    } else {
      floor = floors[0];
      // Load the map for this floor and add it to the DOM.
      xhr = new XMLHttpRequest();
      xhr.open(
        "GET",
        mapUrl + floor + ".svg",
        false
      );
      xhr.overrideMimeType("image/svg+xml");
      xhr.send("");
      document.getElementById("library-map")
        .appendChild(xhr.responseXML.documentElement);

      // Get the SVG data into a variable.
      var svgObject = document.getElementById('library-map');
      var svg = svgObject.firstElementChild;

      // Set the width and height attributes to make the map responsive.
      svg.setAttributeNS(null, 'width', '100%');
      svg.setAttributeNS(null, 'height', '');
    }

    if(ranges.length) {

      // Add the CSS for the circle animation to the SVG file.
      var css = "@keyframes hideshow {0% { opacity: 0; }50% { opacity: 1; }100% { opacity: 0; }}";
      css += ".highlight-circle {opacity:.5;animation: hideshow 5s ease infinite;}";
      var styleElm = document.createElementNS("http://www.w3.org/1999/xhtml", "style");
      styleElm.setAttribute("type", "text/css");
      styleElm.appendChild(document.createTextNode(css));
      svg.appendChild(styleElm);

      // Loop through the ranges and highlight them.
      var rangeString = '';
      for(var i = 0; i < ranges.length; i++) {

        // Turn the label into a properly formatted feature ID.
        var elID = 'f-' + ranges[i].label;

        elID = elID.toLowerCase();

        // Highlight and draw a circle around the element.
        highlight(elID, svg);

        // Add the range label to the text output.
        if(showRanges) {
          // outputString += '<li> ' + ranges[i].label + "</li>";
          rangeString += ranges[i].label + ', ';
        }
      }
      if(showRanges){
        // Drop the trailing comma and any white space.
        rangeString = rangeString.replace(/,\s*$/, "");
        outputString += rangeString + '</p>';
      }

    } else {
      // Could not find a range for this call number in this location.

      // Show error output to the user.
      div.innerHTML += outputString;
      var div = document.getElementById('mapit-output');
      div.innerHTML += nothingFoundError;

      // Throw a JS error.
      throw new Error('Library map error.\nCall number: ' + callnumber + '\nLocation: ' + libLocation);
    }

    // Show the location descripton.
    outputString += '<p>' + locationDescription + '</p>\n';

    div.innerHTML += outputString;
}

// ------------------------------------------------------------------

function highlight(featureId, svg) {

  // Get the element from the feature specified in the query string.
  var featureElement = svg.getElementById(featureId);

  // Test to see if the element exists.
  if (featureElement != null) {

    // console.log("Element found.");

    // Change the element's attributes.
    featureElement.setAttributeNS(null, 'style', "opacity:1;fill:#ff0000");

    // Calculate the center coordinates of the feature element.
    var bbox = featureElement.getBBox();
    var cx = bbox.x + bbox.width/2;
    var cy = bbox.y + bbox.height/2;
    //console.log(bbox);

    // Calculate the radius of a circule to go around the feature element.
    var radius = Math.max(bbox.width, bbox.height)/2 + 10;


    // Draw a circle around the element.
    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    // cx and cy are coordinates for center of the circle.
    circle.setAttributeNS(null, 'cx', cx);
    circle.setAttributeNS(null, 'cy', cy);
    circle.setAttributeNS(null, 'stroke', "#ff0000");
    circle.setAttributeNS(null, 'stroke-width', "4");
    circle.setAttributeNS(null, 'fill', "none");
    circle.setAttributeNS(null, 'class', "highlight-circle");

    // r is the radius.
    circle.setAttributeNS(null, 'r', radius);
    // circle.setAttributeNS(null, 'style', "opacity:1;fill:#ff0000");
    svg.appendChild(circle);


  } else {
    // No element found. There's probably something wrong with the map.
    // TODO: Maybe show an error to the user?
    // console.log("No element found for ID " + featureId);
  }
};
