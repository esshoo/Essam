const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

let sgMail = null;
function getSendGrid(){
  if(sgMail) return sgMail;
  try{
    sgMail = require("@sendgrid/mail");
    const key = functions.config()?.sendgrid?.key;
    if(key) sgMail.setApiKey(key);
    return sgMail;
  }catch(e){
    console.log("SendGrid not installed/ready:", e?.message);
    return null;
  }
}

async function sendEmail(subject, text){
  const mailer = getSendGrid();
  const key = functions.config()?.sendgrid?.key;
  const from = functions.config()?.sendgrid?.from;
  const to = functions.config()?.sendgrid?.to; // admin inbox
  if(!mailer || !key || !from || !to) return;
  await mailer.send({ to, from, subject, text });
}

async function notifyUser(uid, payload){
  const snap = await admin.database().ref(`fcmTokens/${uid}`).get();
  if(!snap.exists()) return;
  const tokens = Object.keys(snap.val() || {});
  if(!tokens.length) return;
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title || "إشعار",
      body: payload.body || ""
    },
    data: payload.data || {}
  });
}

async function writeInApp(uid, notif){
  await admin.database().ref(`notifications/${uid}`).push({
    ...notif,
    createdAt: Date.now(),
    read: false
  });
}

// New request -> notify all admins
exports.onNewRequest = functions.database.ref("/requests/{rid}")
  .onCreate(async (snap, ctx)=>{
    const req = snap.val() || {};
    const rid = ctx.params.rid;

    const adminsSnap = await admin.database().ref("admins").get();
    const admins = adminsSnap.exists()
      ? Object.entries(adminsSnap.val()).filter(([,v])=>v===true).map(([k])=>k)
      : [];

    const title = "طلب دعم جديد";
    const body = `Request: ${rid} • ${req.createdByType || ""} • ${(req.phone||"").trim()}`;

    for(const uid of admins){
      await writeInApp(uid, { title, body, data:{ url:"./admin.html" } });
      await notifyUser(uid, { title, body, data:{ url:"./admin.html" } });
    }

    await sendEmail(title, body);
  });

// Status update -> notify requester
exports.onRequestStatus = functions.database.ref("/requests/{rid}/status")
  .onUpdate(async (change, ctx)=>{
    const before = change.before.val();
    const after = change.after.val();
    if(before === after) return;

    const rid = ctx.params.rid;
    const reqSnap = await admin.database().ref(`requests/${rid}`).get();
    if(!reqSnap.exists()) return;
    const req = reqSnap.val();

    const uid = req.createdByUid;
    if(!uid) return;

    if(after === "accepted"){
      const title = "تم قبول الطلب";
      const body = `تم فتح جلسة الدعم. Request: ${rid}`;
      const url = `./video.html?room=${encodeURIComponent(req.roomId||rid)}&token=${encodeURIComponent(req.roomToken||"")}`;
      await writeInApp(uid, { title, body, data:{ url } });
      await notifyUser(uid, { title, body, data:{ url } });
      await sendEmail(title, body);
    } else if(after === "rejected"){
      const title = "تم رفض الطلب";
      const body = `للأسف تم رفض طلب الدعم. Request: ${rid}`;
      await writeInApp(uid, { title, body, data:{ url:"./index.html" } });
      await notifyUser(uid, { title, body, data:{ url:"./index.html" } });
      await sendEmail(title, body);
    }
  });

// Offline message -> notify admins
exports.onOfflineMessage = functions.database.ref("/offlineMessages/{rid}/{mid}")
  .onCreate(async (snap, ctx)=>{
    const msg = snap.val() || {};
    const rid = ctx.params.rid;

    const adminsSnap = await admin.database().ref("admins").get();
    const admins = adminsSnap.exists()
      ? Object.entries(adminsSnap.val()).filter(([,v])=>v===true).map(([k])=>k)
      : [];

    const title = "رسالة أوفلاين جديدة";
    const body = `Request: ${rid} • ${String(msg.text||"").slice(0,120)}`;

    for(const uid of admins){
      await writeInApp(uid, { title, body, data:{ url:"./admin.html" } });
      await notifyUser(uid, { title, body, data:{ url:"./admin.html" } });
    }

    await sendEmail(title, body);
  });
