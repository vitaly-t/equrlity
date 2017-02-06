"use strict";

export function isMember(grp) {
	let grps = localStorage.getItem('pseudoq.groups');
	return grps && grps.indexOf(grp+',') >= 0;

}

export function isDev() {
    return process.env.NODE_ENV === 'development'
}

