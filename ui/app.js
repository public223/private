const e=(t,p,...c)=>{const el=document.createElement(t);if(p)for(const k of Object.keys(p)){if(k==="className")el.className=p[k];
else if(k==="onClick")el.addEventListener("click",p[k]);
else if(k==="onChange")el.addEventListener("input",p[k]);
else if(k==="value")el.value=p[k];
else if(k==="style")Object.assign(el.style,p[k]);
else el.setAttribute(k,p[k]);}
for(const x of c.flat())if(x!==null&&x!==undefined)el.appendChild(typeof x==="string"?document.createTextNode(x):x);return el;};

const routePrefix=location.pathname.replace(/\/$/,"");
async function api(path,opts={}){const r=await fetch(path,{headers:{"Content-Type":"application/json"},credentials:"include",...opts});return await r.json();}
function fmtTime(sec){if(!sec)return "-";return new Date(sec*1000).toLocaleString();}

const MODULES=["Godmode","HealSpam","SpeedHack","SuperJump","Teleport","Noclip","DamageModifier","WeaponBlacklist","Explosions","EntitySpam","ModelBlacklist","AimAnomaly","HealthArmorIntegrity","EventBlacklist"];

(async function App(){
  const root=document.getElementById("app");
  let state={
    me:null,msg:"",
    login:{username:"",password:""},
    setup:{username:"",password:""},
    settings:{webhooks:{},modules:{}},
    audit:[],
    licenses:[],
    servers:[],
    createLic:{customer_username:"",plan:"basic",days:30},
    bindSrv:{license_key:"",bind_ip:"",server_name:"Server"}
  };
  const setMsg=(m)=>{state.msg=m;render();};

  async function loadMe(){state.me=await api(routePrefix+"/api/me");}
  async function loadSettings(){const r=await api(routePrefix+"/api/settings/get"); if(r.ok){state.settings=r;}}
  async function loadAudit(){const r=await api(routePrefix+"/api/audit"); if(r.ok){state.audit=r.rows||[];}}
  async function loadLicenses(){const r=await api(routePrefix+"/api/licenses/list"); if(r.ok){state.licenses=r.rows||[];}}
  async function loadServers(){const r=await api(routePrefix+"/api/servers/list"); if(r.ok){state.servers=r.rows||[];}}
  async function loadAll(){await loadSettings();await loadAudit();await loadLicenses();await loadServers();}

  async function doSetup(){
    const r=await api(routePrefix+"/api/setup",{method:"POST",body:JSON.stringify(state.setup)});
    setMsg(r.ok?"تم إنشاء الأونر ✅":"فشل: "+(r.error||""));
  }
  async function doLogin(){
    const r=await api(routePrefix+"/api/login",{method:"POST",body:JSON.stringify(state.login)});
    if(r.ok){setMsg("تم تسجيل الدخول ✅");await loadMe();await loadAll();} else setMsg(r.error||"فشل");
    render();
  }
  async function doLogout(){await api(routePrefix+"/api/logout",{method:"POST"});state.me=null;setMsg("تم تسجيل الخروج");render();}

  function role(){return state.me?.role||"";}
  function logged(){return state.me?.logged===true;}
  function canWrite(){return ["owner","admin","moderator"].includes(role());}
  function canLicWrite(){return ["owner","admin","moderator"].includes(role());}

  async function saveWebhooks(){
    const r=await api(routePrefix+"/api/settings/setWebhooks",{method:"POST",body:JSON.stringify({webhooks:state.settings.webhooks})});
    setMsg(r.ok?"تم حفظ Webhooks ✅":(r.error||"فشل"));
  }
  async function saveModules(){
    const r=await api(routePrefix+"/api/settings/setModules",{method:"POST",body:JSON.stringify({modules:state.settings.modules})});
    setMsg(r.ok?"تم حفظ Modules ✅":(r.error||"فشل"));
  }

  async function createLicense(){
    const r=await api(routePrefix+"/api/licenses/create",{method:"POST",body:JSON.stringify(state.createLic)});
    if(r.ok){setMsg("تم إنشاء لايسنس ✅: "+r.license_key);state.createLic={customer_username:"",plan:"basic",days:30};await loadLicenses();}
    else setMsg(r.error||"فشل");
    render();
  }

  async function bindServer(){
    const r=await api(routePrefix+"/api/servers/bind",{method:"POST",body:JSON.stringify(state.bindSrv)});
    setMsg(r.ok?"تم ربط السيرفر بالـ IP ✅":(r.error||"فشل"));
    if(r.ok){state.bindSrv={license_key:"",bind_ip:"",server_name:"Server"};await loadServers();}
    render();
  }

  function render(){
    root.innerHTML="";
    const wrap=e("div",{className:"wrap"});
    wrap.appendChild(e("h1",null,"Pulse AC Panel"));
    if(state.msg)wrap.appendChild(e("div",{className:"card"},state.msg));

    if(!logged()){
      wrap.appendChild(e("div",{className:"card"},
        e("h3",null,"Login"),
        e("div",{className:"row"},
          e("input",{className:"input",placeholder:"username",value:state.login.username,onChange:ev=>state.login.username=ev.target.value}),
          e("input",{className:"input",placeholder:"password",type:"password",value:state.login.password,onChange:ev=>state.login.password=ev.target.value}),
          e("button",{className:"btn",onClick:doLogin},"Login")
        )
      ));
      wrap.appendChild(e("div",{className:"card"},
        e("h3",null,"Setup Owner (مرة وحدة)"),
        e("div",{className:"row"},
          e("input",{className:"input",placeholder:"owner username",value:state.setup.username,onChange:ev=>state.setup.username=ev.target.value}),
          e("input",{className:"input",placeholder:"owner password",type:"password",value:state.setup.password,onChange:ev=>state.setup.password=ev.target.value}),
          e("button",{className:"btn good",onClick:doSetup},"Create Owner")
        )
      ));
      root.appendChild(wrap);return;
    }

    wrap.appendChild(e("div",{className:"card"},
      e("div",{className:"row",style:{justifyContent:"space-between"}},
        e("div",null,"User: ",e("span",{className:"tag"},state.me.username)," Role: ",e("span",{className:"tag"},state.me.role)),
        e("button",{className:"btn bad",onClick:doLogout},"Logout")
      )
    ));

    wrap.appendChild(e("div",{className:"card"},
      e("h3",null,"Webhooks"),
      e("div",{className:"row"},
        ...["server","ac","joinleave","chat","deaths"].map(k =>
          e("input",{className:"input",style:{minWidth:"360px"},placeholder:`${k} webhook`,value:state.settings.webhooks?.[k]||"",onChange:ev=>state.settings.webhooks[k]=ev.target.value})
        )
      ),
      e("div",{className:"row",style:{marginTop:"10px"}},
        e("button",{className:"btn",onClick:saveWebhooks,disabled:!canWrite()},"Save Webhooks")
      )
    ));

    wrap.appendChild(e("div",{className:"card"},
      e("h3",null,"Modules"),
      e("div",{className:"row"},
        MODULES.map(m=>{
          const enabled=state.settings.modules?.[m]===true;
          return e("button",{className:"btn",onClick:()=>{if(!canWrite())return;state.settings.modules[m]=!enabled;render();}},`${enabled?"✅":"❌"} ${m}`);
        })
      ),
      e("div",{className:"row",style:{marginTop:"10px"}},
        e("button",{className:"btn",onClick:saveModules,disabled:!canWrite()},"Save Modules")
      )
    ));

    wrap.appendChild(e("div",{className:"card"},
      e("h3",null,"Create License"),
      e("div",{className:"row"},
        e("input",{className:"input",placeholder:"customer_username",value:state.createLic.customer_username,onChange:ev=>state.createLic.customer_username=ev.target.value}),
        e("input",{className:"input",placeholder:"plan",value:state.createLic.plan,onChange:ev=>state.createLic.plan=ev.target.value}),
        e("input",{className:"input",placeholder:"days (0=life)",value:state.createLic.days,onChange:ev=>state.createLic.days=Number(ev.target.value||0)}),
        e("button",{className:"btn good",onClick:createLicense,disabled:!canLicWrite()},"Create")
      ),
      e("table",{className:"table",style:{marginTop:"10px"}},
        e("thead",null,e("tr",null,e("th",null,"Key"),e("th",null,"Customer"),e("th",null,"Plan"),e("th",null,"Active"),e("th",null,"Expires"))),
        e("tbody",null,(state.licenses||[]).map(l=>e("tr",{key:l.id},
          e("td",null,l.license_key),
          e("td",null,l.customer_username),
          e("td",null,l.plan),
          e("td",null,String(l.is_active)),
          e("td",null,l.expires_at==0?"LIFE":fmtTime(l.expires_at))
        )))
      )
    ));

    wrap.appendChild(e("div",{className:"card"},
      e("h3",null,"Bind Server IP"),
      e("div",{className:"row"},
        e("input",{className:"input",placeholder:"license_key",value:state.bindSrv.license_key,onChange:ev=>state.bindSrv.license_key=ev.target.value}),
        e("input",{className:"input",placeholder:"bind_ip (مثال: 185.234.75.148)",value:state.bindSrv.bind_ip,onChange:ev=>state.bindSrv.bind_ip=ev.target.value}),
        e("input",{className:"input",placeholder:"server_name",value:state.bindSrv.server_name,onChange:ev=>state.bindSrv.server_name=ev.target.value}),
        e("button",{className:"btn good",onClick:bindServer,disabled:!canLicWrite()},"Bind")
      ),
      e("table",{className:"table",style:{marginTop:"10px"}},
        e("thead",null,e("tr",null,e("th",null,"License"),e("th",null,"IP"),e("th",null,"Name"),e("th",null,"Active"),e("th",null,"Last Seen"))),
        e("tbody",null,(state.servers||[]).map(s=>e("tr",{key:s.id},
          e("td",null,s.license_key),
          e("td",null,s.bind_ip),
          e("td",null,s.server_name),
          e("td",null,String(s.is_active)),
          e("td",null,s.last_seen?fmtTime(s.last_seen):"-")
        )))
      )
    ));

    wrap.appendChild(e("div",{className:"card"},
      e("h3",null,"Audit"),
      e("table",{className:"table"},
        e("thead",null,e("tr",null,e("th",null,"actor"),e("th",null,"role"),e("th",null,"action"),e("th",null,"target"),e("th",null,"ip"),e("th",null,"time"))),
        e("tbody",null,(state.audit||[]).map(a=>e("tr",{key:a.id},
          e("td",null,a.actor),e("td",null,a.actor_role),e("td",null,a.action),e("td",null,a.target||"-"),e("td",null,a.ip||"-"),e("td",null,fmtTime(a.created_at))
        )))
      )
    ));

    root.appendChild(wrap);
  }

  await loadMe();
  if(state.me?.logged) await loadAll();
  render();
})();
