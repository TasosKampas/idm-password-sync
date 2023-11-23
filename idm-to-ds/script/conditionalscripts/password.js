logger.info('-------------------ConditionalScript::password::start-------------------');
var result = false; // default
if (object.password != null) {
    var result = true;
    var config = {
        ldapConnectorName: "DS"
    };
    logger.info('ConditionalScript::password::uid:{}', object.userName);
    const query = {'_queryFilter': 'uid eq \"' + target.uid + '\"'};
    const ldapUserQuery = openidm.query("system/" + config.ldapConnectorName + "/account", query);
    if (!!ldapUserQuery && ldapUserQuery.resultCount === 1) {
        try {
            const ldapUser = ldapUserQuery.result[0];
            logger.info("ldapUser_id::" + ldapUser._id);
            const payload = {
                "username": target.uid,
                "password": openidm.decrypt(object.password)
            };
            const systemUser = "system/" + config.ldapConnectorName + "/account/" + ldapUser._id;
            var auth = openidm.action(systemUser, "authenticate", payload);
            if (auth) {
                logger.info('ConditionalScript::password::auth:OK');
                var result = false;
            }
        } catch (e) {
              logger.error('ConditionalScript::password::auth:Exception while authenticating::{}', e);
        }
    } else {
          logger.error('ConditionalScript::password::auth:"Unable to find LDAP user::{}', target.uid);
    }
}
logger.info('-------------------ConditionalScript::password::end-------------------');
result; 