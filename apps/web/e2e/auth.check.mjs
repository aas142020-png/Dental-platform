// Guest auth acceptance checks; creates no Supabase users or staff grants.
import puppeteer from "puppeteer-core";
const base=process.env.BASE_URL??"http://127.0.0.1:8787";
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:true,args:["--no-sandbox"]});
let passed=0;
function check(ok,label){if(!ok)throw new Error(label);passed++;}
try{
 const page=await browser.newPage();
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 for(const locale of ["ar","en"]){
  for(const width of [375,1440]){
   await page.setViewport({width,height:900});
   for(const route of ["sign-in","sign-up","forgot-password","reset-password"]){
    const response=await page.goto(`${base}/${locale}/${route}`,{waitUntil:"networkidle0"});
    check(response.status()===200,`${locale}/${route} HTTP 200`);
    check(await page.$("[data-auth-form]"),`${locale}/${route} form rendered`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${locale}/${route} no overflow`);
   }
  }
  await page.goto(`${base}/${locale}/profile`,{waitUntil:"networkidle0"});
  check(await page.$(`a[href="/${locale}/sign-up"]`),`${locale} guest registration link`);
  await page.goto(`${base}/${locale}/onboarding`,{waitUntil:"networkidle0"});
  check(new URL(page.url()).pathname===`/${locale}/sign-in`,`${locale} onboarding requires authentication`);
  const callback=await fetch(`${base}/auth/callback?locale=${locale}&next=https://evil.invalid`,{redirect:"manual"});
  check(callback.status===307,`${locale} callback redirects`);
  check(new URL(callback.headers.get("location")).pathname===`/${locale}/sign-in`,`${locale} missing callback code rejected`);
 }
 check(errors.length===0,`browser runtime errors: ${errors.join(", ")}`);
 console.log(`guest auth check: ${passed} passed; no accounts created`);
}finally{await browser.close();}
