import { Meteor, Boxes, Groups, expiration_to_utc } from './tools.js';
import * as lti from './canvas_api.js';

export async function update_assignment(_id, update_children) {
    if (!Meteor.isServer) return;
    let box = await Boxes.findOne({ _id: _id }, { fields: { owner: 1, name: 1, grp: 1, parent: 1, levl: 1, lmsid: 1, score: 1, expiration: 1, pblsh: 1, ctgry:1 } });
    if (!box) return;
    if (box.levl == 0) {
        await update_submission(box.parent, [{ _id: box.owner, score: box.score }]);
        return;
    } else if (box.levl == 1) {
        let group = await Groups.findOne({ _id: box.grp }, { fields: { grvt: 1 } });
        if (box.ctgry && box.ctgry != '-' && group && group.grvt && group.grvt.lti) {
            lti.create_edit_assignment(group.grvt.lti, {
                assignment_id: box.lmsid,
                name: box.name,
                points_possible: box.score,
                due: expiration_to_utc(box.expiration),
                published: box.pblsh
            }, async (err, rslt, status, response_headers) => {
                if (!err && rslt && rslt.id) {
                    if (box.lmsid != rslt.id) {
                        box.lmsid = rslt.id;
                        await Boxes.updateOne({_id:_id}, { $set: { lmsid: rslt.id } });
                    }
                    if (update_children && box.lmsid && box.lmsid != '-') {
                        let scores = await Boxes.find({ parent: _id }, { fields: { score: 1, owner: 1 } }).toArray();
                        scores = scores.map(b => { return { _id: b.owner, score: b.score } });
                        update_submission(_id, scores);
                    }
                }
            });
        }
    }
}

export async function link_user(gid, uid, secret) {
    let u = await Meteor.users.findOne({ _id: uid, mgrps: gid }, { fields: { _id: 1, lgrps:1 } }); // make sure I have access
    if (u && !Meteor.isSimulation && (!u.lgrps || u.lgrps.indexOf(gid) == -1)) {
        let g = await Groups.findOne({ _id: gid });
        let ok = g && u.lgrps.indexOf(g._id) == -1; // check not previously set
        if (ok && g.grvt && g.grvt.lti) {
            lti.link_user(g.grvt.lti, secret, async (err, rslt, status, response_headers) => {
                if (rslt && rslt.id) {
                    g = await Groups.findOne({ _id: gid }, { $fields: { mmbrs: 1 } });
                    if (g && g.mmbrs && g.mmbrs.filter(m => m.lmsuid == rslt.id).length == 0) {
                        await Groups.updateOne({ _id: gid, 'mmbrs.vyuid': uid }, { $set: { 'mmbrs.$.lmsuid': rslt.id } });
                        await Meteor.users.updateOne({_id: uid},{$addToSet:{lgrps:gid}});
                        console.log('updated lmsid for', uid, 'to', rslt.id);
                    } else {
                        // someone else has linked this account!
                        console.log('Someone has already linked this account!');
                    }
                }
            });
        }
    }
}

export async function update_submission(pboxid, userid_scores) {
    if (!Meteor.isServer) return;
    let pbox = await Boxes.findOne({_id:pboxid}, { fields: { lmsid: 1, levl: 1, grp: 1, score: 1, ctgry: 1 } });
    if (pbox && pbox.levl == 1 && pbox.lmsid) {
        let group = await Groups.findOne({ _id: pbox.grp }, { fields: { grvt: 1, mmbrs: 1 } });
        if (group && group.grvt) {
            if (pbox.score > 0) {
                let grade_data = {}, unset = [];
                userid_scores.forEach(us => {
                    let found = false;
                    for (var jj = 0; jj < group.mmbrs.length && !found; jj++) {
                        found = group.mmbrs[jj].vyuid.toString() == us._id.toString() && group.mmbrs[jj].lmsuid != '-';
                        if (found) grade_data[group.mmbrs[jj].lmsuid] = { posted_grade: `${us.score}%` };
                    }
                    if (!found) unset.push(us);
                });
                // console.log('Not attempting to update for unlinked scores', unset);
                // console.log('Attempting to update', grade_data);
                if (group.grvt.lti && grade_data != {}) {
                    lti.score_assignment(group.grvt.lti, pbox.lmsid, { grade_data: grade_data },
                        async (err, rslt, status, response_headers) => {
                            console.log('update_submission', grade_data, err, rslt, status)
                        });
                }
            }
        }
    }
}

export async function remove_assignment(groupid, assignment_id) {
    if (!Meteor.isServer) return;
    let group = await Groups.findOne({ _id: groupid }, { fields: { grvt: 1 } });
    if (group && group.grvt && group.grvt.lti) {
        lti.delete_assignment(group.grvt.lti, assignment_id);
    }
}