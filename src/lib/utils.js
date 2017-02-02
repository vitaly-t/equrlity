"use strict";

export function solutionSorter(a,b) { 
    let ma = a.moves;
    let mb = b.moves;
    let acnt = ma[ma.length - 1].moveCount;
    let bcnt = mb[mb.length - 1].moveCount;
    return acnt > bcnt ? 1 : acnt < bcnt ? -1 : 0;

};

export function isMember(grp) {
	let grps = localStorage.getItem('pseudoq.groups');
	return grps && grps.indexOf(grp+',') >= 0;

}

const inactives = [
      "J1", "K1", "L1", "J2", "K2", "L2", "J3", "K3", "L3",
      "J4", "K4", "L4", "J5", "K5", "L5", "J6", "K6", "L6",
      "J16", "K16", "L16", "J17", "K17", "L17", "J18", "K18", "L18",
      "J19", "K19", "L19", "J20", "K20", "L20", "J21", "K21", "L21",
      "A10", "B10", "C10", "D10", "E10", "F10", "P10", "Q10", "R10", "S10", "T10", "U10",
      "A11", "B11", "C11", "D11", "E11", "F11", "P11", "Q11", "R11", "S11", "T11", "U11",
      "A12", "B12", "C12", "D12", "E12", "F12", "P12", "Q12", "R12", "S12", "T12", "U12" ];

export function isCellActive(id) {
    return inactives.indexOf(id) < 0;
};

export function isDev() {
    return process.env.NODE_ENV === 'development'
}
