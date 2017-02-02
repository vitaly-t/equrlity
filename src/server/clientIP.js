'use strict';

export default function clientIP(req) {

    // maybe reverse proxy,load balancer, ...
    const clientIp = req.headers['x-client-ip'];
    const fwdForAlt = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    const clusterClientIp = req.headers['x-cluster-client-ip'];
    const fwdAlt = req.headers['x-forwarded'];
    const fwdFor = req.headers['forwarded-for'];
    const fwd = req.headers['forwarded'];
        
    const reqConnectionRemoteAddress = req.connection ? req.connection.remoteAddress : null;
    const reqSocketRemoteAddress = req.socket ? req.socket.remoteAddress : null;
    const reqConnectionSocketRemoteAddress = (req.connection && req.connection.socket) ? req.connection.socket.remoteAddress : null;
    const reqInfoRemoteAddress = req.info ? req.info.remoteAddress : null;

    let ipAddress = '';

    if (clientIp) ipAddress = clientIp;
    else if (fwdForAlt) {
        // pick first
        const fwdIps = fwdForAlt.split(',');
        ipAddress = fwdIps[0];
    }
    else if (realIp) ipAddress = realIp;
    else if (clusterClientIp) ipAddress = clusterClientIp;
    else if (fwdAlt) ipAddress = fwdAlt;
    else if (fwdFor) ipAddress = fwdFor;
    else if (fwd) ipAddress = fwd;
    else if (reqConnectionRemoteAddress) ipAddress = reqConnectionRemoteAddress;
    else if (reqSocketRemoteAddress) ipAddress = reqSocketRemoteAddress
    else if (reqConnectionSocketRemoteAddress) ipAddress = reqConnectionSocketRemoteAddress
    else if (reqInfoRemoteAddress) ipAddress = reqInfoRemoteAddress
    else ipAddress = null;

    console.log('ip : '+ipAddress);
    return ipAddress;
}



