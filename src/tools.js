import AbortController from "abort-controller"
import { MongoClient } from 'mongodb'

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'myProject';

await client.connect();
console.log('Connected successfully to mongodb');
const db = client.db(dbName);
export const Boxes = db.collection('Boxes');
export const Groups = db.collection('Groups');
export const Meteor = {
  isSimulation:false,
  isServer:true,
  users:db.collection('users')
};

export const parse_links = function(links) {
    let r = {};
    if (links) {
        links.split(',').forEach(link => {
            let ls = link.split(';');
            if (ls.length == 2) {
                let typ = ls[1].replace('rel="','').replace('"','').trim();
                r[typ] = ls[0].trim().replace('<','').replace('>','');
            }
        });
    }
    return r;
}

const EXPIRATION_CONVERSION = 60000;
const two_dig = function(v) { return (v.length == 2) ? v : ("0" + v).slice(-2); }
export function expiration_to_utc(intgr) {
  let t = new Date(intgr*EXPIRATION_CONVERSION); // Minute resolution
  return `${t.getUTCFullYear()}-${two_dig(t.getUTCMonth()+1)}-${two_dig(t.getUTCDate())}T${two_dig(t.getUTCHours())}:${two_dig(t.getUTCMinutes())}:${two_dig(t.getUTCSeconds())}Z`;
}

export const now_time_int = function() {
    let now = new Date();
    return parseInt(now.getTime()/EXPIRATION_CONVERSION); // minute resolution
}

export const fetcher = function(url,options,cb) {
    const controller = new AbortController()
    let request_type = options.request_type || 'POST'; // *GET, POST, PUT, DELETE, etc.
    let headers = options.headers || {'Content-Type': 'application/json'};
    let response_type = options.response_type || 'json';
    let timeout_sec = options.timeout_sec || 90; // default to 90 seconds?
    const timeoutId = setTimeout(() => controller.abort(), timeout_sec*1000);
    let content = {
        method: request_type,
        signal:controller.signal,
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: new Headers(headers),
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    }
    if (options.body) {
        content.body = options.body; // body data type must match "Content-Type" header
    }

    fetch(url, content)
    .then(response => {
        clearTimeout(timeoutId);
        if (response_type == 'text') {
            response.text().then(d => {
                if (cb) cb(undefined, d, response.status, response.headers);
            }).catch(err => {
                if (cb) cb(err, undefined, response.status, response.headers);
            });
        } else {
            response.json().then(d => {
                if (cb) cb(undefined, d, response.status, response.headers);
            }).catch(err => {
                if (cb) cb(err, undefined, response.status, response.headers);
            });
        }
    })
    .catch(err => {
        if (cb) cb(err,undefined,undefined,undefined);
    });
}
