import { fetcher, parse_links } from './tools.js';

/* === SCOPES ===
url:GET|/api/v1/courses/:course_id/assignments
url:POST|/api/v1/courses/:course_id/assignments
url:PUT|/api/v1/courses/:course_id/assignments/:assignment_id
url:DELETE|/api/v1/courses/:course_id/assignments/:assignment_id
url:POST|/api/v1/courses/:course_id/assignments/:assignment_id/submissions/update_grades
url:GET|/api/v1/courses/:course_id/enrollments
*/

const paginated_get = function(url, token, callback) {
    let allresults = [];
    const paginated_ = function(url_) {
        fetcher(url_, {
            request_type:'GET',
            timeout_sec:20,
            headers:{Authorization:`Bearer ${token}`,'Content-Type': 'application/json'},
        }, function(err, rslt, status, response_headers) {
            let links = (response_headers) ? parse_links(response_headers.get('Link')) : {};
            if (rslt && rslt.length > 0) allresults = allresults.concat(rslt);
            if (links.next) {
                paginated_(links.next);
            } else {
                if (callback) callback(err, allresults, status, response_headers);
            }
        });
    }
    paginated_(url);
}

export function list_assignments({url,course_id,token}) {
    paginated_get(`https://${url}/api/v1/courses/${course_id}/assignments`,token, (err,rslt, status, response_headers) => {
        if (!err) rslt.forEach(a => {
            console.log(a.name, a.id, a.due_at, a.points_possible)
        })
    });
}

// https://canvas.instructure.com/doc/api/submissions.html#method.submissions_api.update
export function score_assignment({url,course_id,token}, assignment_id, body, callback) {
    fetcher(`https://${url}/api/v1/courses/${course_id}/assignments/${assignment_id}/submissions/update_grades`, {
        request_type:'POST',
        timeout_sec:20,
        body:JSON.stringify(body),
        headers:{Authorization:`Bearer ${token}`,'Content-Type': 'application/json'},
    }, function(err, rslt, status, response_headers) {
        if (callback) callback(err, rslt, status, response_headers)
    });
}

export function link_user({url,course_id,token}, secret, callback) {
    get_students({url,course_id,token},(err, rslt, status, response_headers) => {
        let instid = null;
        rslt.forEach(student => {
            if (student.user && student.user.login_id == secret) instid = student.user.id;
        })
        if (callback) callback(err, {id:instid}, status, response_headers);
    })
}

export function get_students({url,course_id,token}, callback) {
    paginated_get(`https://${url}/api/v1/courses/${course_id}/enrollments`, token, callback);
}

export function create_edit_assignment({url,course_id,token},{assignment_id,name,points_possible,due,published},callback) {
    let full_url = `https://${url}/api/v1/courses/${course_id}/assignments`;
    let request_type = 'POST';
    if (assignment_id && assignment_id != '-') { // edit pre-existing
        full_url += `/${assignment_id}`;
        request_type = 'PUT';
    }
    fetcher(full_url, {
        request_type:request_type,
        timeout_sec:20,
        body:JSON.stringify({
            assignment:{
                name:`${name}`,
                submission_type:'online_url',
                grading_type:'percent',
                points_possible:points_possible,
                published:published,
                due_at:due
            }
        }),
        headers:{Authorization:`Bearer ${token}`,'Content-Type': 'application/json', accept: 'application/json'},
    }, function(err, rslt, status, response_headers) {
        if (callback) callback(err, rslt, status, response_headers);
    });
}

export function delete_assignment({url,course_id,token},assignment_id,callback) {
    fetcher(`https://${url}/api/v1/courses/${course_id}/assignments/${assignment_id}`, {
        request_type:'DELETE',
        timeout_sec:20,
        body:JSON.stringify({}),
        headers:{Authorization:`Bearer ${token}`,'Content-Type': 'application/json'},
    }, function(err, rslt, status, response_headers) {
        if (callback) callback(err, rslt, status, response_headers);
    });
}