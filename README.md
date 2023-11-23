# Password synchronization with IDM and DS 

## Introduction

This repo consists of a few scripts and configurations related to Password Synchronization between IDM and DS. There are cases where userPassword is overidden on every sync and causes pwdChangedTime to be updated. That will break any password expiration rule applied, or result in unnecessary updates on the target DS. 

The aim is to keep 
- `userPassword`
- `pwdChangedTime`

in correct sync state.


## Use-cases
### IDM to DS
In this case, IDM stores the password encrypted in its repo. To synchronize a password change to DS, a trasnformation script is used on `password` attribute, that decrypts before sending the plain-text password to DS to salt-and-hash it. For most cases, the following transformation script can be used:
```javascript
openidm.decrypt(source);
```
The above works in general, however the problem is that DS doesn't know that its stored hash value matches the incoming plain-text password when updating (it does that though during a BIND). As a result, this will re-salt+hash the clear text and update the `userPassword`. That also means that `pwdChangedTime` **changes** on each sync, which is not useful when expiration policy apply. In the DS audit logs, you will see:
```
# 24/Nov/2022:21:01:21 +0000; conn=199; op=39
dn: uid=tasosk,ou=identities
changetype: modify
replace: userPassword
userPassword: {PBKDF2-HMAC-SHA256}10:524KeQFVVKZogzxrw8DAn4h576DbysbBX0z/NS+vYr78yA89H7XyxwxiUZNeJOYV
-
replace: pwdChangedTime
pwdChangedTime: 20221124210121.616Z
```
To fix this, in the conditional script, we can do a systems call to the connector and make a bind to verify the password matches with the one DS stores. If it matches, the password conditional script will return false, otherwise true. A conditional script like the following can be used
```javascript
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
```

### DS to IDM
In this case, the DS Password Synchronization Plugin must be used and so only for password update. As DS can't decipher the userPassword, it needs to send an update with the clear-text password (encrypted by the IDM key) **before** modifying the password to keep IDM / DS in sync.
No scripts needed in this case. More info about the Plugin can be found here: https://backstage.forgerock.com/docs/idm/7.2/pwd-plugin-guide/chap-sync-dj.html

### Platform IDM to DS
In this case, Platform IDM stores the `password` in **String** format. On the DJ LDAP connector we need to change the `userPassword` native type from **__PASSWORD __** to **String**. During the sync, the base64url-encoded password (`target`) is compared with the non-encoded password (`source`). That means that sync engine will proceed with an update via the LDAP connector. This is not a problem because during the DS password modification, it's the same hash value. So, although `userPassword` is updated, DS won't update `pwdChangedTime`. In the DS audit logs, you'd just see:
```
# 24/Nov/2022:17:11:57 +0000; conn=626; op=16
dn: uid=demo,ou=People,ou=identities
changetype: modify
replace: userPassword
userPassword: {PBKDF2-HMAC-SHA256}10:K3nF0Ery78hmdp4YATrFA+wjypf7DscWlOCGTLKD9MEfwoJTqjusgfEK7fLXyFJF
```
However, if you still want to avoid this unnecessary update on the target DS, you could adjust your conditional script so that the decoded hashes are compared. When they match, then skip the update. A conditional script as below can be used:
```javascript
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
```

### DS to Platform IDM
When IDM is deploymed in a Platform setup with DS as shared repo, the `password` attribute is stored as **String** type of the `userPpassword` hash, as per the schema:
```json
"password": {
    "type": "simple",
    "ldapAttribute": "userPassword"
 },
```
(IDM no longer can validate the user password, only AM can BIND). That means we can sync the Hashed password to IDM, unlike the regular ds-to-idm scenario.
As mentioned before, the LDAP connector base64url-encode the password attribute. That means that during a recon, a transformation script that decodes it is used (source is userPassword in the script):
```javascript
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
```
You can find the steps and configuration here: https://backstage.forgerock.com/docs/idcloud/latest/identities/sync-identities.html#synchronize_passwords 

### DS to DS via IDM
In case you need to reconciliate DS with another DS, it's best if the connector is configured to use the string type. The LDAP connector always base64url-encode the `userPassword`. That means that during a recon, a transformation script that decodes it is used:
```javascript
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
```
Again though, the sync engine will eventually compare the decoded source value against the encoded target value, and since they won't match, it will always proceed with an update. This is again a problem for the `pwdChangedTime` attribute whilst password remains the same. To fix this, again we need a conditional script that compares the encoded password:
```javascript
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
```
