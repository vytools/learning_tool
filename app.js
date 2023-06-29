import express from 'express';
import { Meteor, Boxes, Groups, now_time_int } from './tools.js';
import { ObjectId } from 'mongodb';
import { link_user, update_assignment, update_submission, remove_assignment } from './lms_interface.js';
import { get_students } from './canvas_api.js';

// For canvas api (shouldn't need for lti!)
let GRVT = {lti:{
  token:'create an access token in canvas to go here...',
  url:'canvas.instructure.com',
  course_id:'get the course id...'
}};

// Make some fake users
await Meteor.users.deleteMany({});
await Groups.deleteMany({});
await Boxes.deleteMany({});
await Meteor.users.insertOne({username:'teacher', mgrps:[], lgrps:[]});
await Meteor.users.insertOne({username:'studenta', mgrps:[], lgrps:[]});
await Meteor.users.insertOne({username:'studentb', mgrps:[], lgrps:[]});
let teacher = await Meteor.users.findOne({username:'teacher'});
let studenta = await Meteor.users.findOne({username:'studenta'});
let studentb = await Meteor.users.findOne({username:'studentb'});
let all = [teacher._id, studenta._id, studentb._id];

// Create a "group" owned by the teacher and with all the students as members
await Groups.insertOne({name:'testgroup', owner:teacher._id, grvt:GRVT, mntnc:0, mmbrs:all.map(id=>{ return {vyuid:id,lmsuid:'-'}})});
let group = await Groups.findOne({name:'testgroup'});
for (var ii = 0; ii < all.length; ii++) {
  await Meteor.users.updateOne({_id:all[ii]},{$addToSet:{mgrps:group._id}});
  console.log(await Meteor.users.findOne(all[ii]))
}

// Cheat link users
if (GRVT.lti) {
  get_students(GRVT.lti,(err, allresults, status, response_header) => {
    allresults.forEach(student => {
      if (student.role == 'TeacherEnrollment') {
        link_user(group._id, teacher._id, student.user.login_id);
      } else if (student.role == 'StudentEnrollment') {
        link_user(group._id, studenta._id, student.user.login_id);
      }
    })
  });
}

const randomstring = function() {
  return 'r'+(Math.random() + 1).toString(36).substring(7);
}

async function boxbuttons() {
  let boxes = await Boxes.find({levl:1}).toArray();
  let str = '';
  if (boxes) {
    for (var ii = 0; ii < boxes.length; ii++) {
      let children = await Boxes.find({levl:0,parent:boxes[ii]._id}).toArray();
      let cboxes = children.map(cbox => {
        let s = JSON.stringify(cbox).replace(/"/g,"'");
        return `
        <form class="p-1" action="/launch" method="get">
          <button name="modify_submission" title="${s}" class="btn btn-secondary" value="${cbox._id}">${cbox.score}</button>  
        </form>`;
      }).join('');
      let s = JSON.stringify(boxes[ii]).replace(/"/g,"'");
      str += `<div title="${s}" style="display:flex;" class="p-2">
        <p> Assignment ${boxes[ii].name} (${boxes[ii].score})</p>
        <form class="p-1" action="/launch" method="get">
          <button name="remove_assignment" class="btn btn-primary" value="${boxes[ii].name}">Remove</button>
        </form>
        <form class="p-1" action="/launch" method="get">
          <button name="modify_assignment" class="btn btn-primary" value="${boxes[ii].name}">Modify</button>
        </form>
        ${cboxes}
      </div>`;
   };
  }
  return str;
}

// Create functions to add/modify/remove assignments
async function adda() {
    // Add an "assignment" box 
    // owner, name, grp, parent, levl, lmsid, score, expiration, pblsh, ctgry
    let name = randomstring();
    const box = await Boxes.insertOne({
      owner:teacher._id, name:name, grp:group._id, parent:'-', 
      levl:1, lmsid:'-', score:10, expiration:now_time_int()+60, pblsh:true, ctgry:'Assignment'});
    for (var ii = 0; ii < all.length; ii++) {
        if (all[ii] == teacher._id) continue;
        await Boxes.insertOne({owner:all[ii], name:name, grp:group._id, parent:box.insertedId, 
          levl:0, lmsid:'-', score:80+ii, expiration:now_time_int()+60, pblsh:true, ctgry:'Assignment'});
    }
    await update_assignment(box.insertedId,true);
}

async function moda(name) {
  const box = await Boxes.findOne({name:name, levl:1});
  if (box) {
    await Boxes.updateOne({name:name, levl:1}, {$set:{score:box.score+1, pblsh:!box.pblsh, expiration:box.expiration+20}});
    // for (var ii = 0; ii < all.length; ii++) {
    //   await Boxes.updateOne({name:name, levl:0, owner:all[ii]},{$set:{score:Math.floor(Math.random()*100)}});
    // }
    await update_assignment(box._id, true);
  }
}

async function mods(_id) {
  let obj = new ObjectId(_id);
  const box = await Boxes.findOne({_id:obj});
  if (box) {
    let s = Math.floor(Math.random()*100);
    await Boxes.updateOne({_id:obj}, {$set:{score:s}});
    await update_submission(box.parent, [{_id:box.owner, score:s}]);
  }
}

async function rmva(name) {
  const box = await Boxes.findOne({name:name, levl:1});
  if (box) {
    await remove_assignment(group._id, box.lmsid);
    await Boxes.deleteMany({name:name});
  }
}

// Create the user interface for the app
const app = express();

async function launch(req, res){
  console.log(req.query, req.body, req.headers)
  if (req.query.add_assignment) {
    await adda()
  } else if (req.query.modify_submission) {
    await mods(req.query.modify_submission);
  } else if (req.query.modify_assignment) {
    await moda(req.query.modify_assignment);
  } else if (req.query.remove_assignment) {
    await rmva(req.query.remove_assignment);
  }
  res.send(`<head>
    <meta content="text/html;charset=utf-8" http-equiv="Content-Type">
    <meta content="utf-8" http-equiv="encoding">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/js/bootstrap.min.js"></script>
  </head>
  <body>
    <form class="p-2" action="/launch" method="get">
      <button name="add_assignment" class="btn btn-primary" value="?">Add Assignment</button>
    </form>
    ${await boxbuttons()}
  </body>`);
}

app.post('/launch', launch);
app.get('/launch', launch);

app.get('/config', function(req, res) {
  let url = 'https://' + req.get('host');
  res.send(`
    <cartridge_basiclti_link
      xmlns="http://www.imsglobal.org/xsd/imslticc_v1p0"
      xmlns:blti="http://www.imsglobal.org/xsd/imsbasiclti_v1p0"
      xmlns:lticm="http://www.imsglobal.org/xsd/imslticm_v1p0"
      xmlns:lticp="http://www.imsglobal.org/xsd/imslticp_v1p0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemalocation="http://www.imsglobal.org/xsd/imslticc_v1p0 http://www.imsglobal.org/xsd/lti/ltiv1p0/imslticc_v1p0.xsd http://www.imsglobal.org/xsd/imsbasiclti_v1p0 http://www.imsglobal.org/xsd/lti/ltiv1p0/imsbasiclti_v1p0p1.xsd http://www.imsglobal.org/xsd/imslticm_v1p0 http://www.imsglobal.org/xsd/lti/ltiv1p0/imslticm_v1p0.xsd http://www.imsglobal.org/xsd/imslticp_v1p0 http://www.imsglobal.org/xsd/lti/ltiv1p0/imslticp_v1p0.xsd">
      <blti:title>vytools</blti:title>
      <blti:launch_url>${url}/launch</blti:launch_url>
      <blti:icon>${url}/vy16.png</blti:icon>
      <blti:custom></blti:custom>
      <blti:extensions platform="canvas.instructure.com">
        <lticm:property name="tool_id">vytools</lticm:property>
        <lticm:property name="domain">${url}</lticm:property>
        <lticm:property name="privacy_level">public</lticm:property>
        <lticm:property name="text">vyt</lticm:property>
        <lticm:options name="course_navigation">
          <lticm:property name="enabled">true</lticm:property>
          <lticm:property name="url">${url}/launch</lticm:property>
          <lticm:property name="text">VyToolS</lticm:property>
          <lticm:property name="visibility">public</lticm:property>
        </lticm:options>
      </blti:extensions>
    </cartridge_basiclti_link>`);
});

app.listen(80, () => {
  console.log('Server started on port 80');
});
