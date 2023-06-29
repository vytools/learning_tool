# learning_tool
I attempted an explanation video here.
https://youtu.be/SuJkIIr2_q8

In the video I attempt to explain the app contained in this repository. I also try to explain how it currently interfaces with canvas (the canvas REST api) and how I would like it to interface in the future (remove canvas REST api calls and replace with LTI advantage interface).

This repository is a stripped down version of my app. The frontend is really not too important. The important thing is that 
- The app be able to authenticate using LTI advantage, so that it knows whether the canvas user is a teacher or student and 
- If the user is a teacher the app can create an assignment (along with details such as name, due date, published status, points allowed). The app currently can do this using the canvas REST api. It needs to do it instead using LTI advantage
- If the user is a student the app can modify the submission for an assignment (i.e. points earned). The app currently can do this using the canvas REST api. It needs to do it instead using LTI advantage


The repository contains the following files.
- app.js -> set up routes, create test data and user interface
- lms_interface.js -> converts the apps data (stored in mongodb collections) to a format that can be sent to canvas using the REST api
- canvas_api.js -> Contains the calls to the canvas api
tools.js -> just some utilities and tools used by the other files

I want this to work with other LMS's besides canvas but for now canvas is the main focus (https://canvas.instructure.com/doc/api/file.tools_intro.html). If it goes well we can move to other lms's

To run the app:

docker-compose build

docker-compose up

If you change the package.json file, re-reun docker-compose build