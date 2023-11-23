logger.info('-------------------TransformScript::userPassword::start-------------------');
if (source != null)
{
  	logger.info('Transform::userPassword before decode: {}', source);
    var base64 = Packages.org.forgerock.util.encode.Base64url;
    target = new Packages.java.lang.String(base64.decode(source));
  	logger.info('Transform::userPassword after decode: {}', target);
}
logger.info('-------------------TransformScript::userPassword::end-------------------');
target;