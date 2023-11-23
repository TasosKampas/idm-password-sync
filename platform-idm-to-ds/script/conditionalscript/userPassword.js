var result = true;
logger.info('-------------------ConditionalScript::userPassword::start-------------------');
logger.info('ConditionalScript::userPassword::uid:{}', object.userName);
if (target != null) {
    var base64 = Packages.org.forgerock.util.encode.Base64url;
    decodedpass = new Packages.java.lang.String(base64.decode(target.userPassword));
    logger.info('ConditionalScript::userPassword::uid:{}::target.userPassword: {}', target.uid, target.userPassword);
    logger.info('ConditionalScript::userPassword::uid:{}::target.decoded.userPassword: {}', target.uid, decodedpass);
  	if (object.password == decodedpass) {
      logger.info('ConditionalScript::userPassword::uid:{}::same-password', target.uid);
      var result = false;
    }
}
logger.info('-------------------ConditionalScript::userPassword::end-------------------');
result;