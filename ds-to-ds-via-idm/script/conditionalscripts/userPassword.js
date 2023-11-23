logger.info('-------------------ConditionalScript::userPassword::start-------------------');
var result = true;
logger.info('ConditionalScript::userPassword::uid:{}', object.uid);
logger.info('ConditionalScript::userPassword::uid:{}::object.userPassword: {}', object.uid, object.userPassword);
if (target != null) {
    logger.info('ConditionalScript::userPassword::uid:{}::target.userPassword: {}', target.uid, target.userPassword);
    if (target.userPassword !== object.userPassword) {
        logger.info('ConditionalScript::userPassword::uid:{}::userPassword object and target do not match', object.uid);
    } else {
        logger.info('ConditionalScript::userPassword::uid:{}::userPassword object and target do match', object.uid);
        logger.info('ConditionalScript::userPassword::uid:{}::setting result to false', object.uid);
        result = false;
    }
}
logger.info('ConditionalScript::userPassword::result::{}:user::{}', result, object.uid);
logger.info('-------------------ConditionalScript::userPassword::end-------------------');

result;