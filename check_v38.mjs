
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://mhsasrjpuottlmhsutnb.supabase.co', 'sb_publishable_2lGa4xcG6gxuFTYas0A0Bw_1I56RG5I');
let employees=[], selectedEmployee=null, currentGps=null;
const $=id=>document.getElementById(id);

let currentHrOk = sessionStorage.getItem('peihong_hr_login') === '1';
const HR_ADMIN_ACCOUNT = 'admin';
const HR_ADMIN_PASSWORD = 'peihong2026';
let hrAdminConfig = { account: HR_ADMIN_ACCOUNT, password: HR_ADMIN_PASSWORD };
async function loadHrAdminConfig(){
  try{
    const r = await supabase.from('hr_settings').select('setting_key, setting_value').in('setting_key',['admin_account','admin_password']);
    if(!r.error && Array.isArray(r.data)){
      const map = Object.fromEntries(r.data.map(x=>[x.setting_key, x.setting_value]));
      hrAdminConfig = { account: map.admin_account || HR_ADMIN_ACCOUNT, password: map.admin_password || HR_ADMIN_PASSWORD };
    }
  }catch(e){
    hrAdminConfig = { account: HR_ADMIN_ACCOUNT, password: HR_ADMIN_PASSWORD };
  }
  return hrAdminConfig;
}
function ensureHrLoginBox(){
  const page = $('page-admin');
  if(!page || $('hrLoginBox')) return;
  const box = document.createElement('div');
  box.id = 'hrLoginBox';
  box.className = 'card';
  box.innerHTML = `
    <h1>HR 後台登入</h1>
    <p class="muted">請輸入管理員帳號密碼。手機與電腦都使用此固定登入框，不再跳出視窗。</p>
    <div class="grid grid2">
      <div>
        <label>帳號</label>
        <input id="hrLoginAccount" autocomplete="username" placeholder="admin" />
      </div>
      <div>
        <label>密碼</label>
        <input id="hrLoginPassword" type="password" autocomplete="current-password" placeholder="請輸入後台密碼" />
      </div>
    </div>
    <button class="btnGreen" onclick="hrLoginSubmit()">登入後台</button>
    <div class="muted" style="margin-top:10px">首次預設帳號：admin；密碼：peihong2026。登入後可在後台修改。</div>
  `;
  page.insertBefore(box, page.firstChild);
  ['hrLoginAccount','hrLoginPassword'].forEach(id=>{
    setTimeout(()=>$(id)?.addEventListener('keydown', e=>{ if(e.key==='Enter') hrLoginSubmit(); }),0);
  });
}
function renderHrLoginState(){
  ensureHrLoginBox();
  const page = $('page-admin');
  if(!page) return;
  [...page.children].forEach((child, idx)=>{
    if(child.id === 'hrLoginBox') child.classList.toggle('hide', currentHrOk);
    else child.classList.toggle('hide', !currentHrOk);
  });
}
window.hrLoginSubmit = async function(){
  const acc = ($('hrLoginAccount')?.value || '').trim();
  const pw = ($('hrLoginPassword')?.value || '').trim();
  await loadHrAdminConfig();
  if(acc === hrAdminConfig.account && pw === hrAdminConfig.password){
    currentHrOk = true;
    sessionStorage.setItem('peihong_hr_login','1');
    sessionStorage.setItem('peihong_admin_ok','1');
    renderHrLoginState();
    msg('HR 後台登入成功');
    await loadAdminAll();
    return true;
  }
  msg('HR 帳號或密碼錯誤，請重新輸入','bad');
  return false;
}
function hrLoginPrompt(){
  if(currentHrOk) return true;
  renderHrLoginState();
  msg('請先在頁面中的固定登入框登入 HR 後台','bad');
  return false;
}

window.fillMissingEmployeeAccounts = async function(){
  if(!hrLoginPrompt()) return;
  const q = await supabase.from('employees').select('id, employee_no, login_account');
  if(q.error) return msg('讀取員工失敗：' + q.error.message, 'bad');
  for(const e of (q.data || [])){
    if(!e.login_account && e.employee_no){
      await supabase.from('employees').update({ login_account: e.employee_no }).eq('id', e.id);
    }
  }
  msg('已補齊缺少的員工登入帳號；密碼請逐一由 HR 設定。');
  await loadAdminAll();
}

window.hrLogout = function(){
  currentHrOk = false;
  sessionStorage.removeItem('peihong_hr_login');
  sessionStorage.removeItem('peihong_admin_ok');
  msg('HR 已登出');
  showPage('admin');
}
function getEmployeeAccount(e){
  return e.login_account || e.employee_no;
}
function getEmployeePassword(e){
  return e.login_password || '';
}
window.employeeLogin = async function(){
  const acc = $('empLoginAccount').value.trim();
  const pw = $('empLoginPassword').value.trim();
  if(!acc || !pw) return msg('請輸入帳號與密碼','bad');

  const r = await supabase.rpc('employee_login', { p_account: acc, p_password: pw });
  if(r.error) return msg('登入查詢失敗：' + r.error.message + '。請先執行 V16_必跑SQL.txt','bad');

  const emp = (r.data || [])[0];
  if(!emp){
    return msg('員工帳號或密碼錯誤；若尚未設定密碼，請 HR 到員工列表編輯密碼。','bad');
  }

  selectedEmployee = emp;
  sessionStorage.setItem('peihong_employee_id', emp.id);
  $('employeeLoginCard').classList.add('hide');
  $('employeeWelcomeCard').classList.remove('hide');
  $('employeeWelcome').textContent = `${emp.employee_no}｜${emp.name} 您好`;
  $('employeePanel').classList.remove('hide');
  $('leaveStart').value = dt();
  $('leaveEnd').value = dt(new Date(Date.now()+8*3600000));
  $('myPayrollMonth').value = monthNow(); if($('otDate')) $('otDate').value = new Date().toISOString().slice(0,10); if($('otDate')) $('otDate').value = new Date().toISOString().slice(0,10);
  await loadMyAttendance();
  await loadMyOvertime();
}
window.employeeLogout = function(){
  selectedEmployee = null;
  sessionStorage.removeItem('peihong_employee_id');
  $('employeeLoginCard').classList.remove('hide');
  $('employeeWelcomeCard').classList.add('hide');
  $('employeePanel').classList.add('hide');
  msg('員工已登出');
}
async function tryRestoreEmployeeLogin(){
  await loadEmployees();
  const id = sessionStorage.getItem('peihong_employee_id');
  if(!id) return;
  const emp = employees.find(e => e.id === id);
  if(!emp) return;
  selectedEmployee = emp;
  if($('employeeLoginCard')){
    $('employeeLoginCard').classList.add('hide');
    $('employeeWelcomeCard').classList.remove('hide');
    $('employeeWelcome').textContent = `${emp.employee_no}｜${emp.name} 您好`;
    $('employeePanel').classList.remove('hide');
    $('leaveStart').value = dt();
    $('leaveEnd').value = dt(new Date(Date.now()+8*3600000));
    $('myPayrollMonth').value = monthNow();
    await loadMyAttendance();
  await loadMyOvertime();
}
}


function taipeiTimestamp(){
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((a,p)=>{a[p.type]=p.value;return a;},{});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function fmtTW(v){
  if(!v) return '-';
  const s = String(v).replace('T',' ').replace('Z','');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!m) return s;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'}`;
}
function localInputToTaipeiTimestamp(value){
  if(!value) return null;
  return value.length === 16 ? value + ':00' : value;
}










function money(v){return Number(v||0).toLocaleString('zh-TW')}
function dateOnly(v){return v ? String(v).slice(0,10) : ''}
function yearsBetween(start, end=new Date()){ if(!start) return 0; const s=new Date(start); if(isNaN(s)) return 0; let y=end.getFullYear()-s.getFullYear(); const m=end.getMonth()-s.getMonth(); if(m<0 || (m===0 && end.getDate()<s.getDate())) y--; return Math.max(0,y); }
function monthsBetween(start, end=new Date()){ if(!start) return 0; const s=new Date(start); if(isNaN(s)) return 0; return Math.max(0,(end.getFullYear()-s.getFullYear())*12 + (end.getMonth()-s.getMonth()) - (end.getDate()<s.getDate()?1:0)); }
function statutoryAnnualLeaveDays(hireDate, asOf=new Date()){ const months=monthsBetween(hireDate, asOf); const years=yearsBetween(hireDate, asOf); if(months<6) return 0; if(months<12) return 3; if(years<2) return 7; if(years<3) return 10; if(years<5) return 14; if(years<10) return 15; return Math.min(30, 15 + (years-10+1)); }
function calcAnnualRemaining(total, used){ return Math.max(0, round2(num(total)-num(used))); }
function syncAnnualLeave(prefix){ const hire=$(prefix+'HireDate')?.value; const totalEl=$(prefix+'AnnualLeaveTotal'); const usedEl=$(prefix+'AnnualLeaveUsed'); const remainEl=$(prefix+'AnnualLeaveRemaining'); if(totalEl && (!totalEl.value || Number(totalEl.value)===0) && hire) totalEl.value = statutoryAnnualLeaveDays(hire); if(remainEl) remainEl.value = calcAnnualRemaining(totalEl?.value, usedEl?.value); }
function msg(t,c='ok'){$('msg').innerHTML=`<div class="${c}">${t}</div>`;setTimeout(()=>{$('msg').innerHTML=''},5000)}
function monthNow(){let d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function dt(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function table(h,rows){return `<table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table>`}

const DEFAULT_ADMIN_PIN = '1688';
function getAdminPin(){ return localStorage.getItem('peihong_admin_pin') || DEFAULT_ADMIN_PIN; }
function requireAdminPin(){
  if(sessionStorage.getItem('peihong_admin_ok') === '1') return true;
  const input = prompt('請輸入 HR 後台密碼（預設 1688）');
  if(input === getAdminPin()){
    sessionStorage.setItem('peihong_admin_ok','1');
    return true;
  }
  msg('HR 後台密碼錯誤','bad');
  return false;
}
window.changeAdminPin = async function(){
  if(!hrLoginPrompt()) return;
  await loadHrAdminConfig();
  const oldPw = prompt('請輸入目前 HR 後台密碼');
  if(oldPw !== hrAdminConfig.password) return msg('目前密碼錯誤，未修改','bad');
  const nextAccount = prompt('請輸入新的 HR 帳號', hrAdminConfig.account || 'admin');
  if(!nextAccount || nextAccount.trim().length < 3) return msg('帳號至少 3 碼','bad');
  const nextPw = prompt('請輸入新的 HR 後台密碼（至少 6 碼）');
  if(!nextPw || nextPw.length < 6) return msg('密碼至少 6 碼','bad');
  const confirmPw = prompt('請再輸入一次新密碼');
  if(nextPw !== confirmPw) return msg('兩次密碼不一致，未修改','bad');
  const rows = [
    {setting_key:'admin_account', setting_value: nextAccount.trim(), updated_at: new Date().toISOString()},
    {setting_key:'admin_password', setting_value: nextPw, updated_at: new Date().toISOString()}
  ];
  const r = await supabase.from('hr_settings').upsert(rows, { onConflict: 'setting_key' });
  if(r.error) return msg('後台帳密更新失敗：' + r.error.message + '。請先執行 V24 SQL。','bad');
  hrAdminConfig = { account: nextAccount.trim(), password: nextPw };
  sessionStorage.removeItem('peihong_hr_login');
  sessionStorage.removeItem('peihong_admin_ok');
  currentHrOk = false;
  renderHrLoginState();
  msg('HR 後台帳密已更新，請用新帳密重新登入。');
}
function csvDownload(filename, headers, rows){
  const csv = '\ufeff' + [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
window.createDemoEmployee = async function(){
  if(!hrLoginPrompt()) return;
  const demoNo = 'TEST' + Math.floor(Math.random()*9000+1000);
  const r = await supabase.from('employees').insert({
    employee_no: demoNo,
    name: '測試員工',
    department: '工程部',
    position: '技術員',
    salary: 30000,
    labor_insurance: 659,
    health_insurance: 426,
    dependent_health_insurance: 0,
    login_account: demoNo,
    login_password: 'Test' + Math.floor(Math.random()*900000+100000),
    is_active: true
  });
  if(r.error) return msg('建立測試員工失敗：' + r.error.message, 'bad');
  msg('測試員工已建立：' + demoNo);
  await loadAdminAll();
}
window.exportEmployeesCsv = async function(){
  if(!hrLoginPrompt()) return;
  const r = await supabase.from('employees').select('*').order('employee_no');
  if(r.error) return msg('匯出失敗：' + r.error.message, 'bad');
  csvDownload('沛鴻HR_員工清單.csv',
    ['員工編號','姓名','帳號','密碼','部門','職稱','月薪','勞保','健保','眷屬健保','狀態'],
    (r.data||[]).map(e => [e.employee_no,e.name,e.login_account||e.employee_no,e.login_password?'已設定':'未設定',e.department,e.position,e.salary,e.labor_insurance,e.health_insurance,e.dependent_health_insurance,e.is_active?'在職':'停用'])
  );
}
window.exportAttendanceCsv = async function(){
  if(!hrLoginPrompt()) return;
  const r = await supabase.from('attendance').select('*, employees(employee_no,name)').order('created_at',{ascending:false}).limit(500);
  if(r.error) return msg('匯出失敗：' + r.error.message, 'bad');
  csvDownload('沛鴻HR_出勤紀錄.csv',
    ['員工編號','姓名','上班','下班','地點','GPS Lat','GPS Lng','狀態'],
    (r.data||[]).map(x => [x.employees?.employee_no,x.employees?.name,x.check_in,x.check_out,x.work_location,x.gps_lat,x.gps_lng,x.status])
  );
}

window.showPage=async n=>{document.querySelectorAll('.page').forEach(p=>p.classList.add('hide'));$('page-'+n).classList.remove('hide');const showVersion=n==='admin' && currentHrOk;$('versionTopBanner')?.classList.toggle('hide',!showVersion);$('versionInfoCard')?.classList.toggle('hide',!showVersion);if(n==='employee')await tryRestoreEmployeeLogin();if(n==='admin'){renderHrLoginState();if(currentHrOk)await loadAdminAll();}};

async function loadEmployees(){
  try{
    const r = await supabase.from('employees').select('*').order('employee_no', {ascending:true});
    if(r.error){
      const text = '員工讀取失敗：' + r.error.message;
      if($('employeeDebug')) $('employeeDebug').innerHTML = `<div class="bad">${text}</div>`;
      if($('employeeTable')) $('employeeTable').innerHTML = `<div class="bad">${text}</div>`;
      msg(text, 'bad');
      employees = [];
      return;
    }
    employees = (r.data || []);
    const activeEmployees = employees.filter(e => e.is_active !== false);
    const opts = '<option value="">請選擇員工</option>' + activeEmployees.map(e => `<option value="${e.id}">${e.employee_no || ''}｜${e.name || ''}</option>`).join('');
    if($('empSelect')) $('empSelect').innerHTML = opts;
    if($('payEmpSelect')) { $('payEmpSelect').innerHTML = opts; updatePayrollInputsAuto(); }
    if($('employeeDebug')) $('employeeDebug').innerHTML = `<div class="ok">已讀取員工 ${employees.length} 筆，在職 ${activeEmployees.length} 筆</div>`;
  }catch(err){
    const text = '員工讀取例外：' + (err.message || String(err));
    if($('employeeDebug')) $('employeeDebug').innerHTML = `<div class="bad">${text}</div>`;
    if($('employeeTable')) $('employeeTable').innerHTML = `<div class="bad">${text}</div>`;
    msg(text, 'bad');
    employees = [];
  }
}

window.loadEmployeePanel=async()=>{selectedEmployee=employees.find(e=>e.id===$('empSelect').value);if(!selectedEmployee)return msg('請先選擇員工','bad');$('employeePanel').classList.remove('hide');$('leaveStart').value=dt();$('leaveEnd').value=dt(new Date(Date.now()+8*3600000));$('myPayrollMonth').value=monthNow();await loadMyAttendance()};
window.getGps=()=>{if(!navigator.geolocation)return $('gpsText').textContent='此裝置不支援 GPS';$('gpsText').textContent='取得定位中...';navigator.geolocation.getCurrentPosition(p=>{currentGps={lat:p.coords.latitude,lng:p.coords.longitude};$('gpsText').textContent=`GPS OK：${currentGps.lat.toFixed(6)}, ${currentGps.lng.toFixed(6)}`},()=>{$('gpsText').textContent='GPS 失敗，請允許定位權限'},{enableHighAccuracy:true,timeout:15000})};
async function photo(){let f=$('photoInput').files?.[0];if(!f)return null;return await new Promise(res=>{let r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)})}
window.checkIn=async()=>{if(!selectedEmployee)return msg('請先選擇員工','bad');let p=await photo();let r=await supabase.from('attendance').insert({employee_id:selectedEmployee.id,check_in:taipeiTimestamp(),work_location:$('workLocation').value,gps_lat:currentGps?.lat||null,gps_lng:currentGps?.lng||null,photo_url:p,status:'normal'});if(r.error)return msg('上班打卡失敗：'+r.error.message,'bad');msg('上班打卡成功');await loadMyAttendance()};
window.checkOut=async()=>{if(!selectedEmployee)return msg('請先選擇員工','bad');let r=await supabase.from('attendance').select('*').eq('employee_id',selectedEmployee.id).is('check_out',null).order('created_at',{ascending:false}).limit(1);if(r.error)return msg(r.error.message,'bad');if(!r.data?.length)return msg('找不到未下班的上班紀錄','bad');let u=await supabase.from('attendance').update({check_out:taipeiTimestamp(),gps_lat:currentGps?.lat||null,gps_lng:currentGps?.lng||null}).eq('id',r.data[0].id);if(u.error)return msg(u.error.message,'bad');msg('下班打卡成功');await loadMyAttendance()};
async function loadMyAttendance(){let r=await supabase.from('attendance').select('*').eq('employee_id',selectedEmployee.id).order('created_at',{ascending:false}).limit(20);if(r.error)return msg(r.error.message,'bad');$('myAttendance').innerHTML=table(['上班','下班','地點','狀態'],(r.data||[]).map(x=>[x.check_in?fmtTW(x.check_in):'-',x.check_out?fmtTW(x.check_out):'-',x.work_location||'-',x.status||'-']))}
window.submitLeave=async()=>{if(!selectedEmployee)return msg('請先選擇員工','bad');let r=await supabase.from('leave_requests').insert({employee_id:selectedEmployee.id,leave_type:$('leaveType').value,start_date:localInputToTaipeiTimestamp($('leaveStart').value),end_date:localInputToTaipeiTimestamp($('leaveEnd').value),reason:$('leaveReason').value,status:'pending'});if(r.error)return msg('請假失敗：'+r.error.message,'bad');msg('請假申請已送出')};



window.loadMyPayroll=async()=>{let r=await supabase.from('payroll').select('*').eq('employee_id',selectedEmployee.id).eq('payroll_month',$('myPayrollMonth').value).order('created_at',{ascending:false}).limit(1);if(r.error)return msg(r.error.message,'bad');if(!r.data?.length)return $('myPayroll').innerHTML='<p class="muted">此月份尚無薪資資料</p>';let p=r.data[0];$('myPayroll').innerHTML=`<h3>實發薪資：$${money(p.net_salary)}</h3><p>本薪：$${money(p.base_salary)}｜加班：$${money(p.overtime_pay)}｜津貼：$${money(p.allowance)}</p><p>扣款：$${money(p.deductions)}｜勞保：$${money(p.labor_insurance)}｜健保：$${money(p.health_insurance)}｜眷屬：$${money(p.dependent_health_insurance)}</p>`};
window.loadAdminAll=async()=>{
  await loadEmployees();
  await loadCompany();
  await loadEmployeeTable();
  await loadAttendanceTable();
  await loadLeaveTable();
  if(typeof loadOvertimeTable === 'function') await loadOvertimeTable();
  await loadPayrollTable();
  if($('payMonth')) $('payMonth').value=monthNow();
};
async function loadCompany(){let r=await supabase.from('company_settings').select('*').limit(1);let c=r.data?.[0];if(c){$('companyName').value=c.company_name||'沛鴻聚合工程有限公司';$('companyLat').value=c.gps_lat||'';$('companyLng').value=c.gps_lng||'';$('companyRadius').value=c.gps_radius||100}}
window.saveCompany=async()=>{let q=await supabase.from('company_settings').select('id').limit(1);let p={company_name:$('companyName').value,gps_lat:$('companyLat').value||null,gps_lng:$('companyLng').value||null,gps_radius:Number($('companyRadius').value||100)};let r=q.data?.[0]?await supabase.from('company_settings').update(p).eq('id',q.data[0].id):await supabase.from('company_settings').insert(p);if(r.error)return msg(r.error.message,'bad');msg('公司設定已儲存')};
window.addEmployee=async()=>{
  let p={
    employee_no:$('newEmpNo').value.trim(),
    name:$('newEmpName').value.trim(),
    department:$('newEmpDept').value.trim(),
    position:$('newEmpPos').value.trim(),
    job_grade:$('newEmpGrade')?.value.trim() || '',
    marital_status:$('newEmpMaritalStatus')?.value || '',
    national_id:$('newEmpNationalId')?.value.trim() || '',
    address:$('newEmpAddress')?.value.trim() || '',
    bank_name:$('newEmpBankName')?.value.trim() || '',
    bank_account:$('newEmpBankAccount')?.value.trim() || '',
    bank_card_number:$('newEmpBankCardNumber')?.value.trim() || '',
    phone:$('newEmpPhone')?.value.trim() || '',
    emergency_contact:$('newEmpEmergencyContact')?.value.trim() || '',
    hire_date:$('newEmpHireDate')?.value || null,
    termination_date:$('newEmpTerminationDate')?.value || null,
    annual_leave_total:Number($('newEmpAnnualLeaveTotal')?.value || statutoryAnnualLeaveDays($('newEmpHireDate')?.value)),
    annual_leave_used:Number($('newEmpAnnualLeaveUsed')?.value || 0),
    annual_leave_remaining:calcAnnualRemaining($('newEmpAnnualLeaveTotal')?.value || statutoryAnnualLeaveDays($('newEmpHireDate')?.value), $('newEmpAnnualLeaveUsed')?.value),
    annual_leave_expire_date:$('newEmpAnnualLeaveExpireDate')?.value || null,
    salary:Number($('newEmpSalary').value||0),
    labor_insured_salary:Number($('newEmpLaborInsuredSalary')?.value||0),
    health_insured_salary:Number($('newEmpHealthInsuredSalary')?.value||0),
    manual_labor_insured_salary:Number($('newEmpLaborInsuredSalary')?.value||0),
    manual_health_insured_salary:Number($('newEmpHealthInsuredSalary')?.value||0),
    insurance_manual_override:(Number($('newEmpLaborInsuredSalary')?.value||0)>0 || Number($('newEmpHealthInsuredSalary')?.value||0)>0),
    meal_allowance:Number($('newEmpMeal')?.value||0),
    position_allowance:Number($('newEmpPositionAllowance')?.value||0),
    fixed_fuel_allowance:Number($('newEmpFuel')?.value||0),
    fixed_performance_bonus:Number($('newEmpFixedBonus')?.value||0),
    other_fixed_allowance:Number($('newEmpOtherFixed')?.value||0),
    labor_insurance:Number($('newEmpLabor').value||0),
    health_insurance:Number($('newEmpHealth').value||0),
    health_dependents_count:Number($('newEmpDependents')?.value||0),
    dependent_health_insurance:Number($('newEmpDepHealth').value||0),
    login_account:($('newEmpLogin')?.value||$('newEmpNo').value).trim(),
    login_password:($('newEmpPassword')?.value||'').trim(),
    is_active:true
  };
  const autoIns = syncEmployeeInsurance('newEmp');
  p.labor_insured_salary = autoIns.laborInsured;
  p.health_insured_salary = autoIns.healthInsured;
  p.manual_labor_insured_salary = autoIns.manualOverride ? autoIns.laborInsured : 0;
  p.manual_health_insured_salary = autoIns.manualOverride ? autoIns.healthInsured : 0;
  p.insurance_manual_override = autoIns.manualOverride;
  p.labor_insurance = autoIns.laborEmployee;
  p.health_insurance = autoIns.healthSelf;
  p.dependent_health_insurance = autoIns.depHealth;
  if(!p.employee_no||!p.name)return msg('員工編號與姓名必填','bad');
  let r=await supabase.from('employees').insert(p);
  if(r.error)return msg('新增失敗：'+r.error.message+'。請先執行 V16_必跑SQL.txt','bad');
  msg('員工已新增');
  await loadAdminAll()
};

window.editEmployee = function(id){
  if(!hrLoginPrompt()) return;
  const e = employees.find(x => x.id === id);
  if(!e) return msg('找不到員工資料，請先重新整理後台資料','bad');
  $('editEmployeeCard').classList.remove('hide');
  $('editEmployeeCard').scrollIntoView({behavior:'smooth', block:'start'});
  $('editEmpId').value = e.id;
  $('editEmpNo').value = e.employee_no || '';
  $('editEmpName').value = e.name || '';
  $('editEmpDept').value = e.department || '';
  $('editEmpPos').value = e.position || '';
  $('editEmpGrade').value = e.job_grade || '';
  $('editEmpMaritalStatus').value = e.marital_status || '';
  $('editEmpNationalId').value = e.national_id || '';
  $('editEmpAddress').value = e.address || '';
  $('editEmpBankName').value = e.bank_name || '';
  $('editEmpBankAccount').value = e.bank_account || '';
  $('editEmpBankCardNumber').value = e.bank_card_number || '';
  $('editEmpPhone').value = e.phone || '';
  $('editEmpEmergencyContact').value = e.emergency_contact || '';
  $('editEmpHireDate').value = dateOnly(e.hire_date);
  $('editEmpTerminationDate').value = dateOnly(e.termination_date);
  $('editEmpAnnualLeaveTotal').value = e.annual_leave_total ?? statutoryAnnualLeaveDays(e.hire_date);
  $('editEmpAnnualLeaveUsed').value = e.annual_leave_used ?? 0;
  $('editEmpAnnualLeaveRemaining').value = e.annual_leave_remaining ?? calcAnnualRemaining($('editEmpAnnualLeaveTotal').value, $('editEmpAnnualLeaveUsed').value);
  $('editEmpAnnualLeaveExpireDate').value = dateOnly(e.annual_leave_expire_date);
  $('editEmpLogin').value = e.login_account || e.employee_no || '';
  $('editEmpPassword').value = e.login_password || '';
  $('editEmpSalary').value = e.salary || 0;
  $('editEmpLaborInsuredSalary').value = e.insurance_manual_override ? (e.manual_labor_insured_salary || e.labor_insured_salary || 0) : (e.labor_insured_salary || 0);
  $('editEmpHealthInsuredSalary').value = e.insurance_manual_override ? (e.manual_health_insured_salary || e.health_insured_salary || 0) : (e.health_insured_salary || 0);
  $('editEmpMeal').value = e.meal_allowance || 0;
  $('editEmpPositionAllowance').value = e.position_allowance || 0;
  $('editEmpFuel').value = e.fixed_fuel_allowance || 0;
  $('editEmpFixedBonus').value = e.fixed_performance_bonus || 0;
  $('editEmpOtherFixed').value = e.other_fixed_allowance || 0;
  $('editEmpLabor').value = e.labor_insurance || 0;
  $('editEmpHealth').value = e.health_insurance || 0;
  $('editEmpDependents').value = e.health_dependents_count || 0;
  $('editEmpDepHealth').value = e.dependent_health_insurance || 0;
  $('editEmpActive').value = e.is_active === false ? 'false' : 'true';
  attachInsuranceAutoSync('editEmp');
  ['HireDate','AnnualLeaveTotal','AnnualLeaveUsed'].forEach(k=>{ const el=$('editEmp'+k); if(el && !el.dataset.annualSync){ el.dataset.annualSync='1'; el.addEventListener('input',()=>syncAnnualLeave('editEmp')); el.addEventListener('change',()=>syncAnnualLeave('editEmp')); }});
  syncAnnualLeave('editEmp');
}
window.cancelEmployeeEdit = function(){
  $('editEmployeeCard').classList.add('hide');
}
window.saveEmployeeEdit = async function(){
  if(!hrLoginPrompt()) return;
  const id = $('editEmpId').value;
  if(!id) return msg('沒有選擇員工','bad');
  const payload = {
    employee_no: $('editEmpNo').value.trim(),
    name: $('editEmpName').value.trim(),
    department: $('editEmpDept').value.trim(),
    position: $('editEmpPos').value.trim(),
    job_grade: $('editEmpGrade')?.value.trim() || '',
    marital_status: $('editEmpMaritalStatus')?.value || '',
    national_id: $('editEmpNationalId')?.value.trim() || '',
    address: $('editEmpAddress')?.value.trim() || '',
    bank_name: $('editEmpBankName')?.value.trim() || '',
    bank_account: $('editEmpBankAccount')?.value.trim() || '',
    bank_card_number: $('editEmpBankCardNumber')?.value.trim() || '',
    phone: $('editEmpPhone')?.value.trim() || '',
    emergency_contact: $('editEmpEmergencyContact')?.value.trim() || '',
    hire_date: $('editEmpHireDate')?.value || null,
    termination_date: $('editEmpTerminationDate')?.value || null,
    annual_leave_total: Number($('editEmpAnnualLeaveTotal')?.value || statutoryAnnualLeaveDays($('editEmpHireDate')?.value)),
    annual_leave_used: Number($('editEmpAnnualLeaveUsed')?.value || 0),
    annual_leave_remaining: calcAnnualRemaining($('editEmpAnnualLeaveTotal')?.value || statutoryAnnualLeaveDays($('editEmpHireDate')?.value), $('editEmpAnnualLeaveUsed')?.value),
    annual_leave_expire_date: $('editEmpAnnualLeaveExpireDate')?.value || null,
    login_account: $('editEmpLogin').value.trim() || $('editEmpNo').value.trim(),
    login_password: $('editEmpPassword').value.trim(),
    salary: Number($('editEmpSalary').value || 0),
    labor_insured_salary: Number($('editEmpLaborInsuredSalary')?.value || 0),
    health_insured_salary: Number($('editEmpHealthInsuredSalary')?.value || 0),
    manual_labor_insured_salary: Number($('editEmpLaborInsuredSalary')?.value || 0),
    manual_health_insured_salary: Number($('editEmpHealthInsuredSalary')?.value || 0),
    insurance_manual_override: (Number($('editEmpLaborInsuredSalary')?.value || 0)>0 || Number($('editEmpHealthInsuredSalary')?.value || 0)>0),
    meal_allowance: Number($('editEmpMeal')?.value || 0),
    position_allowance: Number($('editEmpPositionAllowance')?.value || 0),
    fixed_fuel_allowance: Number($('editEmpFuel')?.value || 0),
    fixed_performance_bonus: Number($('editEmpFixedBonus')?.value || 0),
    other_fixed_allowance: Number($('editEmpOtherFixed')?.value || 0),
    labor_insurance: Number($('editEmpLabor').value || 0),
    health_insurance: Number($('editEmpHealth').value || 0),
    health_dependents_count: Number($('editEmpDependents')?.value || 0),
    dependent_health_insurance: Number($('editEmpDepHealth').value || 0),
    is_active: $('editEmpActive').value === 'true'
  };
  const autoIns = syncEmployeeInsurance('editEmp');
  payload.labor_insured_salary = autoIns.laborInsured;
  payload.health_insured_salary = autoIns.healthInsured;
  payload.manual_labor_insured_salary = autoIns.manualOverride ? autoIns.laborInsured : 0;
  payload.manual_health_insured_salary = autoIns.manualOverride ? autoIns.healthInsured : 0;
  payload.insurance_manual_override = autoIns.manualOverride;
  payload.labor_insurance = autoIns.laborEmployee;
  payload.health_insurance = autoIns.healthSelf;
  payload.dependent_health_insurance = autoIns.depHealth;
  if(!payload.employee_no || !payload.name) return msg('員工編號與姓名必填','bad');
  const r = await supabase.from('employees').update(payload).eq('id', id);
  if(r.error) return msg('員工資料儲存失敗：' + r.error.message, 'bad');
  msg('員工資料已更新');
  $('editEmployeeCard').classList.add('hide');
  await loadAdminAll();
}
window.quickSalaryEdit = async function(id){
  if(!hrLoginPrompt()) return;
  const e = employees.find(x => x.id === id);
  if(!e) return;
  const salary = prompt(`請輸入 ${e.name} 新月薪`, e.salary || 0);
  if(salary === null) return;
  const updated = {...e, salary: Number(salary || 0)};
  const wageBase = employeeWageBase(updated);
  const manualLabor = e.insurance_manual_override ? (num(e.manual_labor_insured_salary) || num(e.labor_insured_salary)) : 0;
  const manualHealth = e.insurance_manual_override ? (num(e.manual_health_insured_salary) || num(e.health_insured_salary)) : 0;
  const autoIns = calculateInsuranceFromSalary(updated.salary, updated.health_dependents_count, manualLabor, manualHealth);
  const r = await supabase.from('employees').update({
    salary: updated.salary,
    labor_insured_salary: autoIns.laborInsured,
    health_insured_salary: autoIns.healthInsured,
    manual_labor_insured_salary: autoIns.manualOverride ? autoIns.laborInsured : 0,
    manual_health_insured_salary: autoIns.manualOverride ? autoIns.healthInsured : 0,
    insurance_manual_override: autoIns.manualOverride,
    labor_insurance: autoIns.laborEmployee,
    health_insurance: autoIns.healthSelf,
    dependent_health_insurance: autoIns.depHealth
  }).eq('id', id);
  if(r.error) return msg('月薪修改失敗：' + r.error.message, 'bad');
  msg(`月薪已更新；工資基礎 $${money(wageBase)}，投保基礎只看本薪 $${money(updated.salary)}，勞保級距 ${money(autoIns.laborInsured)}，健保級距 ${money(autoIns.healthInsured)}`);
  await loadAdminAll();
}


async function loadEmployeeTable(){
  await loadEmployees();
  if(!employees.length){
    if($('employeeTable')) $('employeeTable').innerHTML = '<div class="warn">目前沒有員工資料。請先新增員工，或檢查 Supabase employees 表。</div>';
    return;
  }
  $('employeeTable').innerHTML = table(
    ['編號','姓名','帳號','部門','職稱/職等','電話','銀行帳號','到職/離職','特休總/已用/剩餘/期限','本薪','加班基礎','勞保級距','健保級距','勞健保眷屬','狀態','操作'],
    employees.map(e => [
      e.employee_no || '-',
      e.name || '-',
      e.login_account || e.employee_no || '-',
      e.department || '-',
      `${e.position || '-'} / ${e.job_grade || '-'}`,
      e.phone || '-',
      `${e.bank_name || ''} ${e.bank_account || '-'} ${e.bank_card_number ? ' / 卡號：'+e.bank_card_number : ''}`,
      `${dateOnly(e.hire_date) || '-'} / ${dateOnly(e.termination_date) || '-'}`,
      `${num(e.annual_leave_total)} / ${num(e.annual_leave_used)} / ${num(e.annual_leave_remaining)} / ${dateOnly(e.annual_leave_expire_date) || '-'}`,
      '$' + money(e.salary),
      '$' + money(employeeWageBase(e)),
      money(e.labor_insured_salary || bracketAmount(e.salary, laborBrackets)),
      money(e.health_insured_salary || bracketAmount(e.salary, healthBrackets)),
      '$' + money(Number(e.labor_insurance||0) + Number(e.health_insurance||0) + Number(e.dependent_health_insurance||0)),
      e.is_active === false ? '停用' : '在職',
      `<button onclick="editEmployee('${e.id}')">編輯</button><button class="btn2" onclick="quickSalaryEdit('${e.id}')">快速改薪</button><button class="btnRed" onclick="deleteEmployee('${e.id}')">刪除</button>`
    ])
  );
}


let pendingAttendanceImportRows = [];
function excelCellText(v){
  if(v === null || v === undefined) return '';
  if(v instanceof Date && !isNaN(v)){
    const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
    const hh=String(v.getHours()).padStart(2,'0'), mm=String(v.getMinutes()).padStart(2,'0');
    if(hh !== '00' || mm !== '00') return `${hh}:${mm}`;
    return `${y}/${m}/${d}`;
  }
  return String(v).trim();
}
function normalizeExcelDate(v){
  if(v === null || v === undefined || v === '' || v === '--') return '';
  if(v instanceof Date && !isNaN(v)){
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  }
  if(typeof v === 'number'){
    const d = XLSX.SSF.parse_date_code(v);
    if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim().replace(/[年月]/g,'/').replace('日','').replace(/-/g,'/');
  const m = s.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if(!m) return '';
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}
function normalizeExcelTime(v){
  if(v === null || v === undefined || v === '' || v === '--') return '';
  if(v instanceof Date && !isNaN(v)) return `${String(v.getHours()).padStart(2,'0')}:${String(v.getMinutes()).padStart(2,'0')}`;
  if(typeof v === 'number'){
    const totalMinutes = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  if(!s || s === '--') return '';
  const m = s.match(/(\d{1,2})[:：](\d{1,2})/);
  if(!m) return '';
  return `${String(m[1]).padStart(2,'0')}:${String(m[2]).padStart(2,'0')}`;
}
function attendanceImportTimestamp(date, time){
  if(!date || !time) return null;
  return `${date}T${time}:00`;
}
function attendanceDateKeyFromTimestamp(v){
  return v ? String(v).slice(0,10) : '';
}
function attendanceAddDays(dateStr, days){
  const [y,m,d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m-1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
function findImportColumn(headers, names){
  return headers.findIndex(h => names.some(n => String(h||'').replace(/\s/g,'').includes(n)));
}
async function readAttendanceExcelFile(){
  const file = $('attendanceExcelInput')?.files?.[0];
  if(!file) throw new Error('請先選擇Excel檔案');
  if(!window.XLSX) throw new Error('Excel套件尚未載入，請重新整理後再試');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type:'array', cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:''});
  if(!rows.length) throw new Error('Excel沒有資料');
  const headers = rows[0].map(excelCellText);
  const idxNo = findImportColumn(headers, ['員工編號','工號','編號']);
  const idxName = findImportColumn(headers, ['姓名','員工姓名']);
  const idxDept = findImportColumn(headers, ['部門']);
  const idxDate = findImportColumn(headers, ['打卡日期','日期']);
  const idxIn = findImportColumn(headers, ['上班打卡時間','上班時間','上班']);
  const idxOut = findImportColumn(headers, ['下班打卡時間','下班時間','下班']);
  if(idxNo < 0 || idxDate < 0 || idxIn < 0 || idxOut < 0) throw new Error('Excel欄位不完整，至少需要：員工編號、打卡日期、上班打卡時間、下班打卡時間');
  const grouped = new Map();
  const errors = [];
  for(let i=1;i<rows.length;i++){
    const row = rows[i] || [];
    const employeeNo = excelCellText(row[idxNo]).replace(/^'/,'');
    const employeeName = idxName >= 0 ? excelCellText(row[idxName]) : '';
    const department = idxDept >= 0 ? excelCellText(row[idxDept]) : '';
    const date = normalizeExcelDate(row[idxDate]);
    const checkIn = normalizeExcelTime(row[idxIn]);
    const checkOut = normalizeExcelTime(row[idxOut]);
    if(!employeeNo && !date && !checkIn && !checkOut) continue;
    if(!employeeNo || !date){ errors.push(`第${i+1}列缺員工編號或日期`); continue; }
    const key = `${employeeNo}__${date}`;
    if(!grouped.has(key)) grouped.set(key, {employeeNo, employeeName, department, date, checkIn:'', checkOut:'', rowNos:[]});
    const item = grouped.get(key);
    item.rowNos.push(i+1);
    if(checkIn && (!item.checkIn || checkIn < item.checkIn)) item.checkIn = checkIn;
    if(checkOut && (!item.checkOut || checkOut > item.checkOut)) item.checkOut = checkOut;
  }
  const parsed = [...grouped.values()].sort((a,b)=> a.date.localeCompare(b.date) || a.employeeNo.localeCompare(b.employeeNo));
  return {parsed, errors, fileName:file.name};
}
async function buildAttendanceImportPreview(){
  if(!employees.length) await loadEmployees();
  const {parsed, errors, fileName} = await readAttendanceExcelFile();
  const empByNo = new Map(employees.map(e => [String(e.employee_no||'').trim(), e]));
  const dates = parsed.map(x=>x.date).filter(Boolean).sort();
  let existing = [];
  if(dates.length){
    const start = dates[0] + 'T00:00:00';
    const end = attendanceAddDays(dates[dates.length-1], 1) + 'T00:00:00';
    const r = await supabase.from('attendance').select('id, employee_id, check_in, check_out').gte('check_in', start).lt('check_in', end).limit(5000);
    if(r.error) throw new Error('讀取既有出勤失敗：' + r.error.message);
    existing = r.data || [];
  }
  const existingKey = new Map(existing.map(x => [`${x.employee_id}__${attendanceDateKeyFromTimestamp(x.check_in || x.check_out)}`, x]));
  pendingAttendanceImportRows = parsed.map(x => {
    const emp = empByNo.get(String(x.employeeNo||'').trim());
    const key = emp ? `${emp.id}__${x.date}` : '';
    return {
      ...x,
      employeeId: emp?.id || '',
      matchedName: emp?.name || '',
      existsId: key ? (existingKey.get(key)?.id || '') : '',
      status: !emp ? '找不到員工' : (!x.checkIn && !x.checkOut ? '缺上下班' : (existingKey.has(key) ? '已有資料，會更新' : '可匯入'))
    };
  });
  return {fileName, errors, rows: pendingAttendanceImportRows};
}
window.previewAttendanceExcelImport = async function(){
  if(!hrLoginPrompt()) return;
  try{
    const res = await buildAttendanceImportPreview();
    const okCount = res.rows.filter(r=>r.employeeId && (r.checkIn || r.checkOut)).length;
    const updateCount = res.rows.filter(r=>r.existsId).length;
    const missingCount = res.rows.filter(r=>!r.employeeId).length;
    $('attendanceImportSummary').innerHTML = `檔案：${res.fileName}｜合併後 ${res.rows.length} 筆｜可寫入 ${okCount} 筆｜既有更新 ${updateCount} 筆｜找不到員工 ${missingCount} 筆${res.errors.length ? '<br>注意：'+res.errors.join('；') : ''}`;
    $('attendanceImportPreview').innerHTML = table(['狀態','員工編號','Excel姓名','系統姓名','日期','上班','下班','原始列'], res.rows.slice(0,300).map(r=>[r.status,r.employeeNo,r.employeeName||'-',r.matchedName||'-',r.date,r.checkIn||'-',r.checkOut||'-',r.rowNos.join(',')]));
    msg('Excel預覽完成');
  }catch(err){
    $('attendanceImportPreview').innerHTML = `<div class="bad">${err.message || String(err)}</div>`;
    msg(err.message || String(err),'bad');
  }
}
window.confirmAttendanceExcelImport = async function(){
  if(!hrLoginPrompt()) return;
  try{
    if(!pendingAttendanceImportRows.length) await buildAttendanceImportPreview();
    const valid = pendingAttendanceImportRows.filter(r => r.employeeId && (r.checkIn || r.checkOut));
    if(!valid.length) return msg('沒有可寫入的出勤資料','bad');
    let inserted = 0, updated = 0, failed = 0;
    for(const r of valid){
      const payload = {
        employee_id: r.employeeId,
        check_in: attendanceImportTimestamp(r.date, r.checkIn),
        check_out: attendanceImportTimestamp(r.date, r.checkOut),
        work_location: r.department || 'Excel匯入',
        gps_lat: null,
        gps_lng: null,
        photo_url: null,
        status: 'excel_import'
      };
      let q;
      if(r.existsId){
        q = await supabase.from('attendance').update(payload).eq('id', r.existsId);
        if(q.error) failed++; else updated++;
      }else{
        q = await supabase.from('attendance').insert(payload);
        if(q.error) failed++; else inserted++;
      }
      if(q?.error) console.warn('Excel出勤匯入失敗', r, q.error);
    }
    const importedDates = valid.map(x => x.date).filter(Boolean).sort();
    if(importedDates.length){
      initHrReportFilters?.();
      const firstDate = importedDates[0];
      const ySel = $('hrReportYear');
      const mSel = $('hrReportMonth');
      if(ySel) ySel.value = firstDate.slice(0,4);
      if(mSel) mSel.value = firstDate.slice(5,7);
    }
    msg(`Excel匯入完成：新增 ${inserted} 筆、更新 ${updated} 筆、失敗 ${failed} 筆；報表中心已切到匯入月份。`, failed ? 'warn' : 'ok');
    $('attendanceImportSummary').innerHTML = `匯入完成：新增 ${inserted} 筆、更新 ${updated} 筆、失敗 ${failed} 筆；報表中心已切到 ${importedDates[0]?.slice(0,7) || '匯入月份'}。`;
    await loadAttendanceTable();
    if(typeof previewHrReportCounts === 'function') await previewHrReportCounts();
    if(typeof loadPayrollTable === 'function') await loadPayrollTable();
  }catch(err){
    msg(err.message || String(err),'bad');
  }
}

async function loadAttendanceTable(){let r=await supabase.from('attendance').select('*, employees(employee_no,name)').order('created_at',{ascending:false}).limit(100);if(r.error)return;$('attendanceTable').innerHTML=table(['員工','上班','下班','地點','GPS','照片','操作'],(r.data||[]).map(x=>[(x.employees?.employee_no||'')+' '+(x.employees?.name||''),x.check_in?fmtTW(x.check_in):'-',x.check_out?fmtTW(x.check_out):'-',x.work_location||'-',(x.gps_lat&&x.gps_lng)?Number(x.gps_lat).toFixed(5)+', '+Number(x.gps_lng).toFixed(5):'-',x.photo_url?`<img class="photo" src="${x.photo_url}">`:'-',`<button class="btnRed" onclick="deleteAttendance('${x.id}')">刪除</button>`]))}
async function loadLeaveTable(){let r=await supabase.from('leave_requests').select('*, employees(employee_no,name)').order('created_at',{ascending:false}).limit(100);if(r.error)return;$('leaveTable').innerHTML=table(['員工','假別','開始','結束','原因','狀態','操作'],(r.data||[]).map(x=>[(x.employees?.employee_no||'')+' '+(x.employees?.name||''),x.leave_type,x.start_date?fmtTW(x.start_date):'-',x.end_date?fmtTW(x.end_date):'-',x.reason||'-',x.status,(x.status==='pending'?`<button onclick="reviewLeave('${x.id}','approved')">核准</button><button class="btnRed" onclick="reviewLeave('${x.id}','rejected')">退回</button>`:'已處理')+`<button class="btnRed" onclick="deleteLeave('${x.id}')">刪除</button>`]))}
window.reviewLeave=async(id,status)=>{let r=await supabase.from('leave_requests').update({status}).eq('id',id);if(r.error)return msg(r.error.message,'bad');msg('審核完成');await loadLeaveTable()};

const payrollSettings = {
  monthlyHours:240,
  laborRate:0.125,
  laborEmployeeShare:0.2,
  laborCompanyShare:0.7,
  healthRate:0.0517,
  healthEmployeeShare:0.3,
  healthCompanyShare:0.6,
  pensionRate:0.06,
  healthAverageDependents:1.56,
  sickLeaveDeductionRate:0.5
};
const laborBrackets = [[0,29500],[29501,30300],[30301,31800],[31801,33300],[33301,34800],[34801,36300],[36301,38200],[38201,40100],[40101,42000],[42001,43900],[43901,45800]];
const healthBrackets = [[0,29500],[29501,30300],[30301,31800],[31801,33300],[33301,34800],[34801,36300],[36301,38200],[38201,40100],[40101,42000],[42001,43900],[43901,45800],[45801,48200],[48201,50600],[50601,53000],[53001,55400],[55401,57800],[57801,60800],[60801,63800],[63801,66800],[66801,69800],[69801,72800],[72801,76500],[76501,80200],[80201,83900],[83901,87600],[87601,92100],[92101,96600],[96601,101100],[101101,105600]];
const overtimeTypeLabels = {
  weekday_first2:'平日前2小時',
  weekday_after2:'平日後2小時',
  rest_first2:'休息日第1-2小時',
  rest_3to8:'休息日第3-8小時',
  rest_9to12:'休息日第9-12小時',
  holiday_within8:'國定假日/特休出勤8小時內',
  holiday_after8_first2:'國定假日超過8小時-前2小時',
  holiday_after8_after2:'國定假日超過8小時-後2小時',
  regular_emergency:'例假日/法定假日緊急出勤',
  regular_after8_first2:'例假日超過8小時-前2小時',
  regular_after8_after2:'例假日超過8小時-後2小時'
};
const overtimeDayTypeLabels = { weekday:'平日', rest_day:'休息日', national_holiday:'國定假日/特休出勤', regular_holiday:'例假日' };
function inferOvertimeDayType(dateStr){
  if(!dateStr) return 'weekday';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  if(day === 0) return 'regular_holiday';
  if(day === 6) return 'rest_day';
  return 'weekday';
}
function splitOvertimeByLaw(dayType, hours){
  const h = round2(hours);
  const result = {
    weekday_first2:0, weekday_after2:0,
    rest_first2:0, rest_3to8:0, rest_9to12:0,
    holiday_within8:0, holiday_after8_first2:0, holiday_after8_after2:0,
    regular_emergency:0, regular_after8_first2:0, regular_after8_after2:0
  };
  if(h <= 0) return result;
  if(dayType === 'rest_day'){
    result.rest_first2 = Math.min(h,2);
    result.rest_3to8 = Math.min(Math.max(h-2,0),6);
    result.rest_9to12 = Math.max(h-8,0);
  }else if(dayType === 'national_holiday'){
    result.holiday_within8 = Math.min(h,8);
    result.holiday_after8_first2 = Math.min(Math.max(h-8,0),2);
    result.holiday_after8_after2 = Math.max(h-10,0);
  }else if(dayType === 'regular_holiday'){
    result.regular_emergency = Math.min(h,8);
    result.regular_after8_first2 = Math.min(Math.max(h-8,0),2);
    result.regular_after8_after2 = Math.max(h-10,0);
  }else{
    result.weekday_first2 = Math.min(h,2);
    result.weekday_after2 = Math.max(h-2,0);
  }
  return result;
}
function mergeOvertimeHours(target, parts){
  if(!parts) return;
  const alias = {
    weekday_first2_hours:'weekday_first2',
    weekday_after2_hours:'weekday_after2',
    restday_first2_hours:'rest_first2',
    restday_3to8_hours:'rest_3to8',
    restday_9to12_hours:'rest_9to12',
    holiday_hours:'holiday_within8',
    regular_holiday_hours:'regular_emergency'
  };
  for(const k of Object.keys(target)) target[k] = num(target[k]) + num(parts[k]);
  for(const [from,to] of Object.entries(alias)){
    if(parts[from] !== undefined) target[to] = num(target[to]) + num(parts[from]);
  }
}
function getOvertimePayValue(row){
  return num(row.overtime_pay) || num(row.calculated_pay) || num(row.pay_amount) || num(row.overtime_amount) || num(row.total_pay) || num(row.overtime_breakdown?.overtime_pay);
}
function normalizeOvertimeDayType(v){
  if(v === 'restday') return 'rest_day';
  if(v === 'holiday') return 'national_holiday';
  return v || 'weekday';
}

function isApprovedStatus(status){
  const s = String(status || '').trim().toLowerCase();
  return ['approved','approve','核准','已核准','通過','已通過','同意','已同意'].includes(s);
}
function inPayrollMonth(dateValue, month){
  if(!dateValue || !month) return false;
  return String(dateValue).slice(0,7) === String(month).slice(0,7);
}
function summarizeOvertimeSplit(parts){
  const items = Object.entries(parts).filter(([,v])=>num(v)>0).map(([k,v])=>`${overtimeTypeLabels[k]||k} ${v}小時`);
  return items.length ? items.join('、') : '-';
}
function num(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function round2(v){ return Math.round(num(v)*100)/100; }
function round0(v){ return Math.round(num(v)); }
function bracketAmount(salary, brackets){ let result = brackets[0][1]; for(const [min, val] of brackets){ if(num(salary) >= min) result = val; } return result; }
function employeeWageBase(e){
  return num(e.salary)+num(e.meal_allowance)+num(e.position_allowance)+num(e.fixed_fuel_allowance)+num(e.fixed_performance_bonus)+num(e.other_fixed_allowance);
}

function updatePayrollHourlyRate(){
  const sel = $('payEmpSelect');
  const input = $('payHourlyRate');
  if(!sel || !input) return;
  const emp = employees.find(e => e.id === sel.value);
  if(!emp){ input.value = ''; return; }
  input.value = round2(employeeWageBase(emp) / payrollSettings.monthlyHours);
}
function calculateInsuranceFromSalary(salary, dependentsCount=0, manualLaborInsured=0, manualHealthInsured=0){
  const insuranceBase = num(salary);
  const manualOverride = num(manualLaborInsured) > 0 || num(manualHealthInsured) > 0;
  const laborInsured = num(manualLaborInsured) > 0 ? num(manualLaborInsured) : bracketAmount(insuranceBase, laborBrackets);
  const healthInsured = num(manualHealthInsured) > 0 ? num(manualHealthInsured) : bracketAmount(insuranceBase, healthBrackets);
  const laborEmployee = round0(laborInsured * payrollSettings.laborRate * payrollSettings.laborEmployeeShare);
  const healthSelf = round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare);
  const depCount = Math.min(num(dependentsCount), 3);
  const depHealth = round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare * depCount);
  return { insuranceBase, laborInsured, healthInsured, laborEmployee, healthSelf, depCount, depHealth, healthTotal: healthSelf + depHealth, manualOverride };
}
function collectEmployeeForm(prefix){
  const get = id => $(prefix + id);
  return {
    salary: num(get('Salary')?.value),
    labor_insured_salary: num(get('LaborInsuredSalary')?.value),
    health_insured_salary: num(get('HealthInsuredSalary')?.value),
    meal_allowance: num(get('Meal')?.value),
    position_allowance: num(get('PositionAllowance')?.value),
    fixed_fuel_allowance: num(get('Fuel')?.value),
    fixed_performance_bonus: num(get('FixedBonus')?.value),
    other_fixed_allowance: num(get('OtherFixed')?.value),
    health_dependents_count: num(get('Dependents')?.value)
  };
}
function syncEmployeeInsurance(prefix){
  const emp = collectEmployeeForm(prefix);
  const wageBase = employeeWageBase(emp);
  const ins = calculateInsuranceFromSalary(emp.salary, emp.health_dependents_count, emp.labor_insured_salary, emp.health_insured_salary);
  const laborGradeInput = $(prefix + 'LaborInsuredSalary');
  const healthGradeInput = $(prefix + 'HealthInsuredSalary');
  const laborInput = $(prefix + 'Labor');
  const healthInput = $(prefix + 'Health');
  const depInput = $(prefix + 'DepHealth');
  if(laborGradeInput && num(laborGradeInput.value) <= 0) laborGradeInput.value = ins.laborInsured;
  if(healthGradeInput && num(healthGradeInput.value) <= 0) healthGradeInput.value = ins.healthInsured;
  if(laborInput) laborInput.value = ins.laborEmployee;
  if(healthInput) healthInput.value = ins.healthSelf;
  if(depInput) depInput.value = ins.depHealth;
  const preview = $(prefix + 'InsurancePreview');
  if(preview){
    preview.innerHTML = `工資基礎：$${money(wageBase)}｜加班時薪：$${money(round2(wageBase / payrollSettings.monthlyHours))}<br>${ins.manualOverride ? '手動投保金額' : '自動試算投保金額'}｜勞保投保：${money(ins.laborInsured)}，員工勞保：$${money(ins.laborEmployee)}｜健保投保：${money(ins.healthInsured)}，本人健保：$${money(ins.healthSelf)}，眷屬健保：$${money(ins.depHealth)}`;
  }
  return { wageBase, ...ins };
}
function attachInsuranceAutoSync(prefix){
  ['Salary','LaborInsuredSalary','HealthInsuredSalary','Meal','PositionAllowance','Fuel','FixedBonus','OtherFixed','Dependents'].forEach(k=>{
    const el = $(prefix + k);
    if(el && !el.dataset.insuranceSync){
      el.dataset.insuranceSync = '1';
      el.addEventListener('input', () => syncEmployeeInsurance(prefix));
      el.addEventListener('change', () => syncEmployeeInsurance(prefix));
    }
  });
  syncEmployeeInsurance(prefix);
}
function calculateExcelPayroll(emp, month, extra, overtime, leaveDeduction){
  const wageBase = employeeWageBase(emp);
  const hourly = round2(wageBase / payrollSettings.monthlyHours);
  const nonWage = num(extra.midYearBonus)+num(extra.yearEndBonus)+num(extra.festivalBonus)+num(extra.variableBonus)+num(extra.allowance)+num(extra.otherNonWage);
  const insuranceBase = num(emp.salary);
  const laborInsured = num(emp.labor_insured_salary) || bracketAmount(insuranceBase, laborBrackets);
  const healthInsured = num(emp.health_insured_salary) || bracketAmount(insuranceBase, healthBrackets);
  const laborEmployee = num(emp.labor_insurance) || round0(laborInsured * payrollSettings.laborRate * payrollSettings.laborEmployeeShare);
  const healthSelf = num(emp.health_insurance) || round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare);
  const depCount = Math.min(num(emp.health_dependents_count), 3);
  const depHealth = num(emp.dependent_health_insurance) || round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare * depCount);
  const healthTotal = healthSelf + depHealth;
  const gross = round2(wageBase + nonWage + overtime.total);
  const deductions = round2(num(extra.manualDeduction) + leaveDeduction.amount + laborEmployee + healthTotal);
  const net = round2(gross - deductions);
  const laborCompany = round0(laborInsured * payrollSettings.laborRate * payrollSettings.laborCompanyShare);
  const healthCompany = round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthCompanyShare * payrollSettings.healthAverageDependents);
  const pension = round0(laborInsured * payrollSettings.pensionRate);
  return {wageBase,hourly,nonWage,laborInsured,healthInsured,laborEmployee,healthSelf,depCount,depHealth,healthTotal,gross,deductions,net,laborCompany,healthCompany,pension,companyTotal:round2(gross+laborCompany+healthCompany+pension)};
}

function daysInMonth(month){
  const [y,m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;
function overtimeRoundByQuarterHour(hours){
  return round2(Math.floor(Math.max(0, num(hours)) * 4) / 4);
}
function overtimeRoundByHalfHourThreshold(hours){ return overtimeRoundByQuarterHour(hours); }
function halfHourFloor(hours){ return overtimeRoundByQuarterHour(hours); }
function halfHourRuleText(){ return '加班以15分鐘為單位計算：每滿15分鐘計0.25小時，不足15分鐘不計。'; }
function leaveHours(start, end){
  if(!start || !end) return 0;
  let s = new Date(String(start).replace(' ', 'T'));
  let e = new Date(String(end).replace(' ', 'T'));
  if(isNaN(s) || isNaN(e) || e <= s) return 0;
  let total = 0;
  const day = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  while(day <= e){
    const ws = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORK_START_HOUR, 0, 0);
    const we = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORK_END_HOUR, 0, 0);
    const from = s > ws ? s : ws;
    const to = e < we ? e : we;
    if(to > from) total += (to - from) / 3600000;
    day.setDate(day.getDate()+1);
  }
  return Math.round(total*100)/100;
}
function getLeaveDeductionRate(leaveType){
  const t = String(leaveType || '').trim();
  if(t.includes('事假')) return Number($('payPersonalRate')?.value || 1);
  if(t.includes('病假')) return Number($('paySickRate')?.value || 0.5);
  if(t.includes('曠職')) return 1;
  if(t.includes('特休')) return 0;
  if(t.includes('公假')) return 0;
  if(t.includes('婚假')) return 0;
  if(t.includes('喪假')) return 0;
  return 0;
}
async function getLeaveDeductionAmount(empId, month, baseSalary){
  // V37：請假扣款改成容錯核准狀態，避免「核准/已核准」抓不到。
  const start = month + '-01';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  const r = await supabase.from('leave_requests')
    .select('*')
    .eq('employee_id', empId)
    .gte('start_date', start)
    .lt('start_date', end);
  if(r.error) throw new Error('核准請假讀取失敗：' + r.error.message);
  const rows = (r.data||[]).filter(row => isApprovedStatus(row.status));
  const daySalary = Number(baseSalary||0) / daysInMonth(month);
  const hourSalary = daySalary / 8;
  let total = 0;
  const details = [];
  for(const row of rows){
    const hrs = leaveHours(row.start_date, row.end_date);
    const rate = getLeaveDeductionRate(row.leave_type);
    const amount = Math.round(hrs * hourSalary * rate * 100) / 100;
    total += amount;
    details.push({type:row.leave_type, hours:hrs, rate, amount});
  }
  const annualHours = details.filter(d=>String(d.type||'').includes('特休')).reduce((a,d)=>a+num(d.hours),0);
  return {amount: Math.round(total*100)/100, details, rows, annualLeaveDaysUsed: round2(annualHours/8)};
}


function calcHours(date, start, end){
  if(!date || !start || !end) return 0;
  let s = new Date(`${date}T${start}:00`);
  const legalStart = new Date(`${date}T17:00:00`);
  if(s < legalStart) s = legalStart;
  let e = new Date(`${date}T${end}:00`);
  if(e <= s) e = new Date(e.getTime() + 24*60*60*1000);
  return overtimeRoundByQuarterHour((e - s) / 3600000);
}

function dateOnlyFromTs(v){
  if(!v) return '';
  return String(v).slice(0,10);
}
function timeOnlyFromTs(v){
  if(!v) return '';
  const s = String(v);
  const m = s.match(/T(\d{1,2}:\d{2})/) || s.match(/\s(\d{1,2}:\d{2})/) || s.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : '';
}
function calcAutoOvertimeHoursFromCheckout(date, checkOut){
  const outTime = timeOnlyFromTs(checkOut) || normalizeExcelTime(checkOut);
  if(!date || !outTime) return 0;
  // V37.5 修正：自動加班只算同一天 17:00 以後的下班。
  // 早於或等於 17:00 的下班不能套用 calcHours 的跨日邏輯，否則 16:03 會被誤判成隔天 16:03，產生約 23 小時加班。
  const m = String(outTime).match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return 0;
  const outMinutes = Number(m[1]) * 60 + Number(m[2]);
  const standardEnd = 17 * 60;
  if(outMinutes <= standardEnd) return 0;
  return Math.floor((outMinutes - standardEnd) / 15) * 0.25;
}
async function getAutoAttendanceOvertimeBreakdown(empId, month, hourlyRate, skipDates){
  const start = month + '-01T00:00:00';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10) + 'T00:00:00';
  const r = await supabase.from('attendance')
    .select('*')
    .eq('employee_id', empId)
    .gte('check_out', start)
    .lt('check_out', end)
    .limit(5000);
  if(r.error) throw new Error('打卡自動加班讀取失敗：' + r.error.message);
  const hours = {
    weekday_first2:0, weekday_after2:0, rest_first2:0, rest_3to8:0, rest_9to12:0,
    holiday_within8:0, holiday_after8_first2:0, holiday_after8_after2:0,
    regular_emergency:0, regular_after8_first2:0, regular_after8_after2:0
  };
  const rows = [];
  for(const row of (r.data || [])){
    const date = dateOnlyFromTs(row.check_out || row.check_in);
    if(!date || (skipDates && skipDates.has(date))) continue;
    const h = calcAutoOvertimeHoursFromCheckout(date, row.check_out);
    if(h <= 0) continue;
    const dayType = inferOvertimeDayType(date);
    const parts = splitOvertimeByLaw(dayType, h);
    mergeOvertimeHours(hours, parts);
    rows.push({...row, auto_overtime_date: date, auto_overtime_hours: h, auto_overtime_day_type: dayType, auto_overtime_breakdown: parts});
  }
  const pay = {
    weekday: round2(hourlyRate * (hours.weekday_first2*1.34 + hours.weekday_after2*1.67)),
    rest: round2(hourlyRate * (hours.rest_first2*1.34 + hours.rest_3to8*1.67 + hours.rest_9to12*2.67)),
    holiday: round2((hours.holiday_within8 > 0 ? hourlyRate * 8 : 0) + hourlyRate * (hours.holiday_after8_first2*1.34 + hours.holiday_after8_after2*1.67)),
    regular: round2(hourlyRate * (hours.regular_emergency*2 + hours.regular_after8_first2*1.34 + hours.regular_after8_after2*1.67))
  };
  const totalHours = Object.values(hours).reduce((a,b)=>a+num(b),0);
  const total = round2(pay.weekday + pay.rest + pay.holiday + pay.regular);
  return {hours, totalHours:round2(totalHours), pay, total, rows};
}
window.submitOvertime = async function(){
  if(!selectedEmployee) return msg('請先登入員工','bad');
  const date = $('otDate')?.value;
  const start = $('otStart')?.value;
  const end = $('otEnd')?.value;
  const reason = $('otReason')?.value || '';
  const hours = calcHours(date, start, end);
  const dayType = inferOvertimeDayType(date);
  const split = splitOvertimeByLaw(dayType, hours);
  if(!date || !start || !end || hours <= 0) return msg('請填寫正確加班日期與時間；平日加班從17:00後起算，且每滿15分鐘計0.25小時','bad');

  const payload = {
    employee_id: selectedEmployee.id,
    overtime_date: date,
    start_time: start,
    end_time: end,
    overtime_hours: hours,
    overtime_type: 'auto',
    overtime_day_type: dayType,
    overtime_breakdown: split,
    reason,
    status: 'pending'
  };

  const r = await supabase.from('overtime_requests').insert(payload).select('*').single();
  if(r.error) return msg('加班申請失敗：' + r.error.message + '。請確認已執行 V13 必跑SQL。','bad');

  msg(`加班申請已送出，共 ${hours} 小時；系統暫判 ${overtimeDayTypeLabels[dayType]}，拆分：${summarizeOvertimeSplit(split)}，等待 HR 審核`);
  if($('otReason')) $('otReason').value = '';
  await loadMyOvertime();
}
async function loadMyOvertime(){
  if(!selectedEmployee || !$('myOvertime')) return;
  const r = await supabase.from('overtime_requests')
    .select('*')
    .eq('employee_id', selectedEmployee.id)
    .order('created_at', {ascending:false})
    .limit(30);
  if(r.error){
    $('myOvertime').innerHTML = `<div class="bad">加班紀錄讀取失敗：${r.error.message}</div>`;
    return;
  }
  $('myOvertime').innerHTML = table(['日期','當日類型','時間','時數','加班費','系統拆分','原因','狀態'], (r.data||[]).map(x => {
    const dayType = normalizeOvertimeDayType(x.overtime_day_type || x.day_type || inferOvertimeDayType(x.overtime_date));
    const parts = x.overtime_breakdown || splitOvertimeByLaw(dayType, x.overtime_hours);
    return [
      x.overtime_date || '-',
      overtimeDayTypeLabels[dayType] || '平日',
      `${String(x.start_time||'').slice(0,5)}~${String(x.end_time||'').slice(0,5)}`,
      x.overtime_hours || 0,
      '$'+money(getOvertimePayValue(x)),
      summarizeOvertimeSplit(parts),
      x.reason || '-',
      x.status || 'pending'
    ];
  }));
}
async function loadOvertimeTable(){
  if(!$('overtimeTable')) return;
  const r = await supabase.from('overtime_requests')
    .select('*, employees(employee_no,name)')
    .order('created_at',{ascending:false})
    .limit(200);
  if(r.error){
    $('overtimeTable').innerHTML = '<div class="bad">加班審核讀取失敗：' + r.error.message + '。請確認已執行 V13 必跑SQL。</div>';
    return;
  }
  $('overtimeTable').innerHTML = table(['員工','日期','當日類型','時間','時數','系統拆分','原因','狀態','操作'], (r.data||[]).map(x => {
    const dayType = normalizeOvertimeDayType(x.overtime_day_type || x.day_type || inferOvertimeDayType(x.overtime_date));
    const parts = x.overtime_breakdown || splitOvertimeByLaw(dayType, x.overtime_hours);
    const typeSelect = `<select onchange="updateOvertimeDayType('${x.id}', this.value)"><option value="weekday" ${dayType==='weekday'?'selected':''}>平日</option><option value="rest_day" ${dayType==='rest_day'?'selected':''}>休息日</option><option value="national_holiday" ${dayType==='national_holiday'?'selected':''}>國定假日/特休</option><option value="regular_holiday" ${dayType==='regular_holiday'?'selected':''}>例假日</option></select>`;
    return [
      (x.employees?.employee_no||'') + ' ' + (x.employees?.name||''),
      x.overtime_date || '-',
      typeSelect,
      `${String(x.start_time||'').slice(0,5)}~${String(x.end_time||'').slice(0,5)}`,
      x.overtime_hours || 0,
      '$'+money(getOvertimePayValue(x)),
      summarizeOvertimeSplit(parts),
      x.reason || '-',
      x.status || 'pending',
      (x.status || 'pending') === 'pending'
        ? `<button onclick="reviewOvertime('${x.id}','approved')">核准</button><button class="btnRed" onclick="reviewOvertime('${x.id}','rejected')">退回</button><button class="btnRed" onclick="deleteOvertime('${x.id}')">刪除</button>`
        : `已處理<button class="btnRed" onclick="deleteOvertime('${x.id}')">刪除</button>`
    ];
  }));
}
window.updateOvertimeDayType = async function(id, dayType){
  if(!hrLoginPrompt()) return;
  const current = await supabase.from('overtime_requests').select('*').eq('id', id).single();
  if(current.error) return msg('加班資料讀取失敗：' + current.error.message, 'bad');
  const parts = splitOvertimeByLaw(dayType, current.data.overtime_hours);
  const r = await supabase.from('overtime_requests').update({overtime_day_type:dayType, overtime_breakdown:parts}).eq('id', id);
  if(r.error) return msg('加班類型更新失敗：' + r.error.message, 'bad');
  msg('已更新加班當日類型，系統已重新拆分加班時段');
  await loadOvertimeTable();
}
window.reviewOvertime = async function(id, status){
  if(!hrLoginPrompt()) return;
  const r = await supabase.from('overtime_requests').update({status}).eq('id', id);
  if(r.error) return msg('加班審核失敗：' + r.error.message,'bad');
  msg(status === 'approved' ? '加班已核准' : '加班已退回');
  await loadOvertimeTable();
}

async function getApprovedOvertimeBreakdown(empId, month, hourlyRate){
  // V37：不只依賴單一 status='approved'，改成讀取該月資料後在前端容錯判斷核准狀態。
  // 這樣舊資料若是「核准 / 已核准 / 通過 / approved」都能被薪資頁帶入。
  const start = month + '-01';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  const r = await supabase.from('overtime_requests')
    .select('*')
    .eq('employee_id', empId)
    .gte('overtime_date', start)
    .lt('overtime_date', end);
  if(r.error) throw new Error('核准加班讀取失敗：' + r.error.message + '。請確認加班資料表欄位完整。');

  const approvedRows = (r.data||[]).filter(row => isApprovedStatus(row.status));
  const hours = {
    weekday_first2:0, weekday_after2:0, rest_first2:0, rest_3to8:0, rest_9to12:0,
    holiday_within8:0, holiday_after8_first2:0, holiday_after8_after2:0,
    regular_emergency:0, regular_after8_first2:0, regular_after8_after2:0
  };
  for(const row of approvedRows){
    if(row.overtime_breakdown){
      mergeOvertimeHours(hours, row.overtime_breakdown);
    }else if(row.overtime_type && row.overtime_type !== 'auto'){
      const type = row.overtime_type || 'weekday_first2';
      hours[type] = num(hours[type]) + num(row.overtime_hours || row.total_hours || row.calculated_hours);
    }else{
      const dayType = normalizeOvertimeDayType(row.overtime_day_type || row.day_type || inferOvertimeDayType(row.overtime_date));
      mergeOvertimeHours(hours, splitOvertimeByLaw(dayType, row.overtime_hours || row.total_hours || row.calculated_hours));
    }
  }

  const manualDates = new Set(approvedRows.map(row => String(row.overtime_date || row.date || '').slice(0,10)).filter(Boolean));
  const autoOt = await getAutoAttendanceOvertimeBreakdown(empId, month, hourlyRate, manualDates);
  mergeOvertimeHours(hours, autoOt.hours);

  const pay = {
    weekday: round2(hourlyRate * (hours.weekday_first2*1.34 + hours.weekday_after2*1.67)),
    rest: round2(hourlyRate * (hours.rest_first2*1.34 + hours.rest_3to8*1.67 + hours.rest_9to12*2.67)),
    holiday: round2((hours.holiday_within8 > 0 ? hourlyRate * 8 : 0) + hourlyRate * (hours.holiday_after8_first2*1.34 + hours.holiday_after8_after2*1.67)),
    regular: round2(hourlyRate * (hours.regular_emergency*2 + hours.regular_after8_first2*1.34 + hours.regular_after8_after2*1.67))
  };
  const totalHours = Object.values(hours).reduce((a,b)=>a+num(b),0);
  const storedTotal = round2(approvedRows.reduce((sum,row)=>sum+getOvertimePayValue(row),0));
  const calculatedTotal = round2(pay.weekday + pay.rest + pay.holiday + pay.regular);
  const manualCalculatedTotal = round2(calculatedTotal - autoOt.total);
  const total = round2((storedTotal > 0 ? storedTotal : manualCalculatedTotal) + autoOt.total);
  return {hours, totalHours:round2(totalHours), pay, total, rows:approvedRows, storedTotal, calculatedTotal, autoAttendance:autoOt, rawRows:r.data||[]};
}
window.fillApprovedOvertimePay = async function(){
  if(!hrLoginPrompt()) return;
  if(!employees.length) await loadEmployees();
  const emp = employees.find(e=>e.id === $('payEmpSelect')?.value);
  const month = $('payMonth')?.value;
  if(!emp || !month) return msg('請先選員工與薪資月份','bad');
  try{
    const hourlyRate = round2(employeeWageBase(emp) / payrollSettings.monthlyHours);
    if($('payHourlyRate')) $('payHourlyRate').value = hourlyRate;
    const ot = await getApprovedOvertimeBreakdown(emp.id, month, hourlyRate);
    $('payOvertime').value = ot.total;
    msg(`已依系統自動拆分加班時段帶入：${ot.totalHours} 小時，加班費 $${money(ot.total)}`);
  }catch(err){
    msg(err.message || String(err),'bad');
  }
}

window.updatePayrollInputsAuto = async function(){
  updatePayrollHourlyRate();
  try{
    if(!employees.length) return;
    const emp = employees.find(e=>e.id === $('payEmpSelect')?.value);
    const month = $('payMonth')?.value;
    if(!emp || !month || !$('payOvertime')) return;
    const hourlyRate = round2(employeeWageBase(emp) / payrollSettings.monthlyHours);
    if($('payHourlyRate')) $('payHourlyRate').value = hourlyRate;
    const ot = await getApprovedOvertimeBreakdown(emp.id, month, hourlyRate);
    $('payOvertime').value = ot.total || 0;
    const tip = document.getElementById('payOvertimeAutoTip');
    if(tip) tip.textContent = `已自動帶入加班：核准單 ${(ot.totalHours - (ot.autoAttendance?.totalHours || 0)).toFixed(2)} 小時 + 打卡自動 ${(ot.autoAttendance?.totalHours || 0).toFixed(2)} 小時 / $${money(ot.total)}`;
  }catch(err){
    console.warn('自動帶入加班費失敗', err);
    if($('payOvertime')) $('payOvertime').value = $('payOvertime').value || 0;
  }
}

async function buildPayrollPayload(emp, month){
  const wageBase = employeeWageBase(emp);
  const leaveDeduction = await getLeaveDeductionAmount(emp.id, month, wageBase);
  const hourlyRate = round2(wageBase / payrollSettings.monthlyHours);
  if($('payHourlyRate')) $('payHourlyRate').value = hourlyRate;
  const overtime = await getApprovedOvertimeBreakdown(emp.id, month, hourlyRate);
  const extra = {
    allowance: num($('payAllowance')?.value),
    midYearBonus: num($('payMidBonus')?.value),
    yearEndBonus: num($('payYearBonus')?.value),
    festivalBonus: num($('payFestivalBonus')?.value),
    variableBonus: num($('payVariableBonus')?.value),
    otherNonWage: num($('payOtherNonWage')?.value),
    manualDeduction: num($('payDeductions')?.value)
  };
  const result = calculateExcelPayroll(emp, month, extra, overtime, leaveDeduction);
  const payload = {
    employee_id: emp.id,
    payroll_month: month,
    base_salary: num(emp.salary),
    overtime_pay: overtime.total,
    allowance: result.nonWage,
    deductions: round2(extra.manualDeduction + leaveDeduction.amount),
    labor_insurance: result.laborEmployee,
    health_insurance: result.healthSelf,
    dependent_health_insurance: result.depHealth,
    net_salary: result.net,
    wage_base_total: result.wageBase,
    overtime_hourly_rate: result.hourly,
    weekday_overtime_pay: overtime.pay.weekday,
    restday_overtime_pay: overtime.pay.rest,
    holiday_overtime_pay: overtime.pay.holiday,
    regular_holiday_overtime_pay: overtime.pay.regular,
    gross_salary: result.gross,
    deduction_total: result.deductions,
    labor_insured_salary: result.laborInsured,
    health_insured_salary: result.healthInsured,
    health_dependents_count: result.depCount,
    employee_health_total: result.healthTotal,
    company_labor_insurance: result.laborCompany,
    company_health_insurance: result.healthCompany,
    company_pension: result.pension,
    company_total_cost: result.companyTotal,
    payroll_detail: {employee:{employee_no:emp.employee_no,name:emp.name,department:emp.department,position:emp.position,job_grade:emp.job_grade,marital_status:emp.marital_status,national_id:emp.national_id,address:emp.address,bank_name:emp.bank_name,bank_account:emp.bank_account,bank_card_number:emp.bank_card_number,phone:emp.phone,emergency_contact:emp.emergency_contact,hire_date:emp.hire_date,termination_date:emp.termination_date,annual_leave_expire_date:emp.annual_leave_expire_date,salary:emp.salary,meal_allowance:emp.meal_allowance,position_allowance:emp.position_allowance,fixed_fuel_allowance:emp.fixed_fuel_allowance,fixed_performance_bonus:emp.fixed_performance_bonus,other_fixed_allowance:emp.other_fixed_allowance,annual_leave_total:emp.annual_leave_total,annual_leave_used:emp.annual_leave_used,annual_leave_remaining:emp.annual_leave_remaining,health_dependents_count:emp.health_dependents_count},extra,overtime,leaveDeduction,result}
  };
  return {payload, result, overtime, leaveDeduction, extra};
}

window.autoCalculatePayroll = async function(){
  if(!hrLoginPrompt()) return;
  if(!employees.length) await loadEmployees();
  const emp = employees.find(e=>e.id === $('payEmpSelect').value);
  if(!emp) return msg('請選員工','bad');
  const month = $('payMonth').value;
  if(!month) return msg('請選薪資月份','bad');
  try{
    const {payload,result,overtime,leaveDeduction,extra} = await buildPayrollPayload(emp, month);
    $('payOvertime').value = payload.overtime_pay;
    const html = `
      <div class="card">
        <h3>Excel薪資自動計算明細</h3>
        <table>
          <tr><td>員工</td><td>${emp.employee_no}｜${emp.name}</td></tr>
          <tr><td>部門/職稱/職等</td><td>${emp.department || '-'} / ${emp.position || '-'} / ${emp.job_grade || '-'}</td></tr>
          <tr><td>婚姻/電話/緊急聯絡人</td><td>${emp.marital_status || '-'} / ${emp.phone || '-'} / ${emp.emergency_contact || '-'}</td></tr>
          <tr><td>居住地址</td><td>${emp.address || '-'}</td></tr>
          <tr><td>薪轉帳戶</td><td>${emp.bank_name || '-'} / ${emp.bank_account || '-'}${emp.bank_card_number ? ' / 卡號：'+emp.bank_card_number : ''}</td></tr>
          <tr><td>月薪/本薪</td><td>$${money(emp.salary)}</td></tr>
          <tr><td>伙食津貼</td><td>$${money(emp.meal_allowance)}</td></tr>
          <tr><td>職務加給</td><td>$${money(emp.position_allowance)}</td></tr>
          <tr><td>固定油資補助</td><td>$${money(emp.fixed_fuel_allowance)}</td></tr>
          <tr><td>固定績效獎金</td><td>$${money(emp.fixed_performance_bonus)}</td></tr>
          <tr><td>其他固定津貼</td><td>$${money(emp.other_fixed_allowance)}</td></tr>
          <tr><td>到職日/離職日</td><td>${dateOnly(emp.hire_date)||'-'} / ${dateOnly(emp.termination_date)||'-'}</td></tr>
          <tr><td>特休總/已用/剩餘/期限</td><td>${num(emp.annual_leave_total)} / ${num(emp.annual_leave_used)} / ${num(emp.annual_leave_remaining)} 天｜期限 ${dateOnly(emp.annual_leave_expire_date)||'-'}</td></tr>
          <tr><td>加班工資基礎合計</td><td>$${money(result.wageBase)}</td></tr>
          <tr><td>投保基礎</td><td>只看本薪 $${money(emp.salary)}</td></tr>
          <tr><td>加班時薪</td><td>$${money(result.hourly)}</td></tr>
          <tr><td>平日加班費</td><td>$${money(overtime.pay.weekday)}</td></tr>
          <tr><td>休息日加班費</td><td>$${money(overtime.pay.rest)}</td></tr>
          <tr><td>國定假日加班費</td><td>$${money(overtime.pay.holiday)}</td></tr>
          <tr><td>例假日加班費</td><td>$${money(overtime.pay.regular)}</td></tr>
          <tr><td>打卡自動加班</td><td>${overtime.autoAttendance?.totalHours || 0} 小時｜$${money(overtime.autoAttendance?.total || 0)}</td></tr>
          <tr><td>加班費合計</td><td>$${money(overtime.total)}</td></tr>
          <tr><td>不列入工資項目</td><td>$${money(result.nonWage)}</td></tr>
          <tr><td>應發合計</td><td>$${money(result.gross)}</td></tr>
          <tr><td>請假扣款</td><td>$${money(leaveDeduction.amount)}</td></tr>
          <tr><td>其他扣款</td><td>$${money(extra.manualDeduction)}</td></tr>
          <tr><td>勞保(員工)</td><td>$${money(result.laborEmployee)}｜級距 ${money(result.laborInsured)}</td></tr>
          <tr><td>本人健保</td><td>$${money(result.healthSelf)}｜級距 ${money(result.healthInsured)}</td></tr>
          <tr><td>家屬健保</td><td>$${money(result.depHealth)}｜人數 ${result.depCount}</td></tr>
          <tr><td>扣款總計</td><td>$${money(result.deductions)}</td></tr>
          <tr><td><b>實發薪資</b></td><td><b>$${money(result.net)}</b></td></tr>
          <tr><td>公司負擔</td><td>勞保 $${money(result.laborCompany)}｜健保 $${money(result.healthCompany)}｜勞退 $${money(result.pension)}</td></tr>
          <tr><td>公司總成本</td><td>$${money(result.companyTotal)}</td></tr>
        </table>
        <p class="muted">請假明細：${leaveDeduction.details.map(d=>`${d.type} ${d.hours}小時 扣$${money(d.amount)}`).join('；') || '無'}</p>
      </div>`;
    if($('payrollCalcDetail')) $('payrollCalcDetail').innerHTML = html;
    const r = await supabase.from('payroll').insert(payload);
    if(r.error) return msg('薪資寫入失敗：' + r.error.message + '。請先執行 V16_必跑SQL.txt', 'bad');
    msg('薪資已依 Excel 公式自動計算並寫入');
    await loadPayrollTable();
  }catch(err){
    msg(err.message || String(err), 'bad');
  }
}

window.createPayroll = async function(){
  if(!hrLoginPrompt()) return;
  if(!employees.length) await loadEmployees();
  const emp = employees.find(e=>e.id === $('payEmpSelect').value);
  if(!emp) return msg('請選員工','bad');
  const month = $('payMonth').value;
  if(!month) return msg('請選薪資月份','bad');
  try{
    const {payload} = await buildPayrollPayload(emp, month);
    payload.overtime_pay = num($('payOvertime')?.value) || payload.overtime_pay;
    const r = await supabase.from('payroll').insert(payload);
    if(r.error) return msg('薪資寫入失敗：' + r.error.message + '。請先執行 V16_必跑SQL.txt', 'bad');
    msg('薪資已產生');
    await loadPayrollTable();
  }catch(err){ msg(err.message || String(err),'bad'); }
}

window.loadInsuranceTotals = async function(){
  if(!hrLoginPrompt()) return;
  const r = await supabase.from('payroll').select('*').order('created_at',{ascending:false}).limit(1000);
  if(r.error) return msg('勞健保總額讀取失敗：' + r.error.message,'bad');
  const rows = r.data || [];
  const sum = k => rows.reduce((a,x)=>a+num(x[k]),0);
  $('insuranceTotals').innerHTML = table(['項目','金額'], [
    ['員工勞保總額','$'+money(sum('labor_insurance'))],
    ['員工本人健保總額','$'+money(sum('health_insurance'))],
    ['員工眷屬健保總額','$'+money(sum('dependent_health_insurance'))],
    ['員工健保總扣款','$'+money(sum('health_insurance')+sum('dependent_health_insurance'))],
    ['公司勞保負擔','$'+money(sum('company_labor_insurance'))],
    ['公司健保負擔','$'+money(sum('company_health_insurance'))],
    ['公司勞退6%','$'+money(sum('company_pension'))],
    ['公司總成本','$'+money(sum('company_total_cost'))]
  ]);
}


async function deleteRow(tableName, id, reloadFn, label){
  if(!hrLoginPrompt()) return;
  if(!confirm(`確定要刪除這筆${label}嗎？刪除後不能復原。`)) return;
  const r = await supabase.from(tableName).delete().eq('id', id);
  if(r.error) return msg(`${label}刪除失敗：` + r.error.message + '。請確認已執行 V22_必跑SQL.txt', 'bad');
  msg(`${label}已刪除`);
  if(reloadFn) await reloadFn();
}
window.deleteAttendance = id => deleteRow('attendance', id, loadAttendanceTable, '出勤紀錄');
window.deleteLeave = id => deleteRow('leave_requests', id, loadLeaveTable, '請假紀錄');
window.deleteOvertime = id => deleteRow('overtime_requests', id, loadOvertimeTable, '加班紀錄');
window.deletePayroll = id => deleteRow('payroll', id, loadPayrollTable, '薪資紀錄');
window.deleteEmployee = async function(id){
  if(!hrLoginPrompt()) return;
  const emp = employees.find(e => e.id === id);
  const name = emp ? `${emp.employee_no || ''} ${emp.name || ''}` : '此員工';
  if(!confirm(`確定要刪除 ${name} 嗎？\n系統會一併刪除該員工的出勤、請假、加班與薪資紀錄，刪除後不能復原。`)) return;
  for(const tableName of ['payroll','attendance','leave_requests','overtime_requests']){
    const r = await supabase.from(tableName).delete().eq('employee_id', id);
    if(r.error) return msg(`刪除員工相關${tableName}資料失敗：` + r.error.message + '。請確認已執行 V22_必跑SQL.txt', 'bad');
  }
  const r = await supabase.from('employees').delete().eq('id', id);
  if(r.error) return msg('員工刪除失敗：' + r.error.message + '。請確認已執行 V22_必跑SQL.txt', 'bad');
  msg('員工與相關紀錄已刪除');
  await loadAdminAll();
}

async function loadPayrollTable(){let r=await supabase.from('payroll').select('*, employees(employee_no,name)').order('created_at',{ascending:false}).limit(100);if(r.error)return;$('payrollTable').innerHTML=table(['月份','員工','本薪','加班','津貼','扣款','勞健保眷屬','實發','操作'],(r.data||[]).map(p=>[p.payroll_month,(p.employees?.employee_no||'')+' '+(p.employees?.name||''),'$'+money(p.base_salary),'$'+money(p.overtime_pay),'$'+money(p.allowance),'$'+money(p.deductions),'$'+money(+p.labor_insurance+ +p.health_insurance+ +p.dependent_health_insurance),'$'+money(p.net_salary),`<button class="btnRed" onclick="deletePayroll('${p.id}')">刪除</button>`]))}
window.addEventListener('load',()=>{ loadEmployees().then(updatePayrollHourlyRate); attachInsuranceAutoSync('newEmp'); ['HireDate','AnnualLeaveTotal','AnnualLeaveUsed'].forEach(k=>{ const el=$('newEmp'+k); if(el){ el.addEventListener('input',()=>syncAnnualLeave('newEmp')); el.addEventListener('change',()=>syncAnnualLeave('newEmp')); }}); syncAnnualLeave('newEmp'); });


// ===== V37.1 HR後台報表中心：單一 Excel 多工作表（只讀資料，不改核心邏輯） =====
function hrReportN(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
function hrReportPick(o, keys, d=''){ for(const k of keys){ if(o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; } return d; }
function hrReportDate(v){ return v ? String(v).slice(0,10) : ''; }
function hrReportAttendanceDate(a){
  return hrReportDate(hrReportPick(a,['date','work_date','attendance_date'], '') || a.check_in || a.check_out || a.check_in_time || a.check_out_time || a.clock_in || a.clock_out || a.created_at);
}
function hrReportTime(v){ return v ? String(v).slice(0,5) : ''; }
function hrReportMoney(v){ return Math.round(hrReportN(v)*100)/100; }
function initHrReportFilters(){
  const ySel = $('hrReportYear'); if(!ySel || ySel.dataset.ready === '1') return;
  const now = new Date(); const y = now.getFullYear();
  ySel.innerHTML = '';
  for(let yy=y-3; yy<=y+1; yy++){
    const opt=document.createElement('option'); opt.value=String(yy); opt.textContent=String(yy); if(yy===y) opt.selected=true; ySel.appendChild(opt);
  }
  const mSel = $('hrReportMonth'); if(mSel) mSel.value = String(now.getMonth()+1).padStart(2,'0');
  ySel.dataset.ready = '1';
}
function hrReportInRange(dateStr){
  const d = hrReportDate(dateStr); if(!d) return true;
  const year = $('hrReportYear')?.value || '';
  const month = $('hrReportMonth')?.value || 'all';
  if(year && !d.startsWith(year + '-')) return false;
  if(month !== 'all' && d.slice(5,7) !== month) return false;
  return true;
}
function hrReportPeriodLabel(){
  const year = $('hrReportYear')?.value || String(new Date().getFullYear());
  const month = $('hrReportMonth')?.value || 'all';
  return month === 'all' ? `${year}_全年` : `${year}_${month}`;
}
async function hrReportFetchAll(tableName){
  const rows=[]; let from=0; const step=1000;
  while(true){
    const r = await supabase.from(tableName).select('*').range(from, from+step-1);
    if(r.error){ console.warn('HR report fetch failed', tableName, r.error); return rows; }
    rows.push(...(r.data||[]));
    if(!r.data || r.data.length < step) break;
    from += step;
  }
  return rows;
}
async function hrReportLoadAllData(){
  msg('報表資料讀取中，請稍候...', 'warn');
  const [employeesData, payrollData, attendanceData, leaveData, overtimeData] = await Promise.all([
    hrReportFetchAll('employees'),
    hrReportFetchAll('payroll'),
    hrReportFetchAll('attendance'),
    hrReportFetchAll('leave_requests'),
    hrReportFetchAll('overtime_requests')
  ]);
  const empMap = Object.fromEntries((employeesData||[]).map(e => [String(e.id), e]));
  return { employees: employeesData||[], payroll: payrollData||[], attendance: attendanceData||[], leaveReq: leaveData||[], overtime: overtimeData||[], empMap };
}
function hrReportEmpName(empMap, id){ const e=empMap[String(id)]||{}; return hrReportPick(e,['name','employee_name'],''); }
function hrReportEmpNo(empMap, id){ const e=empMap[String(id)]||{}; return hrReportPick(e,['employee_no','emp_no','code'],''); }
function hrReportOverviewSheet(data){
  const payrollInRange = data.payroll.filter(p => hrReportInRange(p.created_at || p.payroll_month || p.month));
  const otInRange = data.overtime.filter(o => hrReportInRange(o.overtime_date || o.date || o.created_at));
  const leaveInRange = data.leaveReq.filter(l => hrReportInRange(l.start_date || l.leave_start || l.start_time || l.created_at));
  const active = data.employees.filter(e => hrReportPick(e,['is_active'],true) !== false && !hrReportPick(e,['termination_date'],''));
  const totalSalary = payrollInRange.reduce((s,p)=>s+hrReportN(p.net_salary||p.net_pay||p.actual_pay||p.gross_salary||p.base_salary),0);
  const totalOtPay = otInRange.reduce((s,o)=>s+hrReportN(o.overtime_pay||o.calculated_pay||o.pay_amount||o.overtime_amount||o.total_pay),0);
  const totalOtHours = otInRange.reduce((s,o)=>s+hrReportN(o.overtime_hours||o.total_hours||o.calculated_hours),0);
  const totalLeaveHours = leaveInRange.reduce((s,l)=>s+hrReportN(l.leave_hours||l.hours||l.total_hours),0);
  const leaveRemaining = data.employees.reduce((s,e)=>s+hrReportN(e.annual_leave_remaining),0);
  return [['項目','數值'],['報表期間',hrReportPeriodLabel()],['員工總數',data.employees.length],['在職人數',active.length],['離職/停用人數',data.employees.length-active.length],['薪資筆數',payrollInRange.length],['薪資總額',hrReportMoney(totalSalary)],['加班筆數',otInRange.length],['加班總時數',hrReportMoney(totalOtHours)],['加班費總額',hrReportMoney(totalOtPay)],['請假筆數',leaveInRange.length],['請假總時數',hrReportMoney(totalLeaveHours)],['特休剩餘總天數',hrReportMoney(leaveRemaining)],['匯出時間',new Date().toLocaleString('zh-TW')]];
}
function hrReportEmployeesSheet(data){
  const rows=[['員工編號','姓名','部門','職稱','職等','婚姻','身分證','電話','地址','緊急聯絡人','銀行','銀行代碼','薪轉帳號','金融卡號','本薪','伙食津貼','職務加給','勞保投保','健保投保','勞保扣款','健保扣款','眷屬健保','到職日','離職日','特休總天數','特休已用','特休剩餘','特休期限','狀態']];
  data.employees.forEach(e=>rows.push([hrReportPick(e,['employee_no','emp_no']),hrReportPick(e,['name','employee_name']),hrReportPick(e,['department']),hrReportPick(e,['position','title']),hrReportPick(e,['job_grade']),hrReportPick(e,['marital_status']),hrReportPick(e,['national_id']),hrReportPick(e,['phone']),hrReportPick(e,['address']),hrReportPick(e,['emergency_contact','emergency_contact_name']),hrReportPick(e,['bank_name']),hrReportPick(e,['bank_code']),hrReportPick(e,['bank_account']),hrReportPick(e,['bank_card_number','bank_card_no']),hrReportN(e.salary),hrReportN(e.meal_allowance),hrReportN(e.position_allowance),hrReportN(e.labor_insured_salary),hrReportN(e.health_insured_salary),hrReportN(e.labor_insurance),hrReportN(e.health_insurance),hrReportN(e.dependent_health_insurance),hrReportDate(e.hire_date),hrReportDate(e.termination_date),hrReportN(e.annual_leave_total),hrReportN(e.annual_leave_used),hrReportN(e.annual_leave_remaining),hrReportDate(e.annual_leave_expire_date),(e.is_active===false?'停用':'在職')]));
  return rows;
}
function hrReportPayrollSheet(data){
  const rows=[['月份','員工編號','姓名','本薪','工資基礎','加班費','津貼','勞保','健保','眷屬健保','扣款','應發/總薪資','實發薪資','建立時間']];
  data.payroll.filter(p=>hrReportInRange(p.created_at || p.payroll_month || p.month)).forEach(p=>rows.push([hrReportPick(p,['payroll_month','month']),hrReportEmpNo(data.empMap,p.employee_id),hrReportEmpName(data.empMap,p.employee_id),hrReportN(p.base_salary),hrReportN(p.wage_base_total),hrReportN(p.overtime_pay||p.pay_amount||p.calculated_pay),hrReportN(p.allowance),hrReportN(p.labor_insurance),hrReportN(p.health_insurance),hrReportN(p.dependent_health_insurance||p.employee_health_total),hrReportN(p.deductions||p.deduction_total),hrReportN(p.gross_salary||p.gross_pay),hrReportN(p.net_salary||p.net_pay),hrReportDate(p.created_at)]));
  return rows;
}
function hrReportAttendanceSheet(data){
  const rows=[['日期','員工編號','姓名','上班時間','下班時間','地點/備註','GPS','來源/狀態','照片','建立時間']];
  data.attendance.filter(a=>hrReportInRange(hrReportAttendanceDate(a))).forEach(a=>rows.push([
    hrReportAttendanceDate(a),
    hrReportEmpNo(data.empMap,a.employee_id),
    hrReportEmpName(data.empMap,a.employee_id),
    hrReportPick(a,['check_in_time','check_in','clock_in']),
    hrReportPick(a,['check_out_time','check_out','clock_out']),
    hrReportPick(a,['location','work_location','note']),
    [hrReportPick(a,['lat','latitude','gps_lat']),hrReportPick(a,['lng','longitude','gps_lng'])].filter(Boolean).join(','),
    hrReportPick(a,['status','source'],''),
    hrReportPick(a,['photo_url','photo']),
    hrReportDate(a.created_at)
  ]));
  return rows;
}
function hrReportLeaveSheet(data){
  const rows=[['申請日','員工編號','姓名','假別','開始','結束','時數','原因','狀態','審核人','審核時間']];
  data.leaveReq.filter(l=>hrReportInRange(l.start_date || l.leave_start || l.start_time || l.created_at)).forEach(l=>rows.push([hrReportDate(l.created_at),hrReportEmpNo(data.empMap,l.employee_id),hrReportEmpName(data.empMap,l.employee_id),hrReportPick(l,['leave_type','type']),hrReportPick(l,['start_time','leave_start','start_date']),hrReportPick(l,['end_time','leave_end','end_date']),hrReportN(l.leave_hours||l.hours||l.total_hours),hrReportPick(l,['reason','memo']),hrReportPick(l,['status','approved_status']),hrReportPick(l,['reviewed_by','approved_by']),hrReportPick(l,['reviewed_at','approved_at'])]));
  return rows;
}
function hrReportOvertimeSheet(data){
  const rows=[['日期','員工編號','姓名','開始','結束','日別','加班時數','平日前2','平日後續','休息日前2','休息日3-8','休息日9-12','國定假日','例假日','加班費','原因','狀態','審核人','建立時間']];
  data.overtime.filter(o=>hrReportInRange(o.overtime_date || o.date || o.created_at)).forEach(o=>rows.push([hrReportDate(o.overtime_date||o.date),hrReportEmpNo(data.empMap,o.employee_id),hrReportEmpName(data.empMap,o.employee_id),hrReportTime(o.start_time||o.overtime_start),hrReportTime(o.end_time||o.overtime_end),hrReportPick(o,['day_type','overtime_day_type','overtime_type']),hrReportN(o.overtime_hours||o.total_hours||o.calculated_hours),hrReportN(o.weekday_first2_hours),hrReportN(o.weekday_after2_hours),hrReportN(o.restday_first2_hours),hrReportN(o.restday_3to8_hours),hrReportN(o.restday_9to12_hours),hrReportN(o.holiday_hours),hrReportN(o.regular_holiday_hours),hrReportMoney(o.overtime_pay||o.calculated_pay||o.pay_amount||o.overtime_amount||o.total_pay),hrReportPick(o,['reason']),hrReportPick(o,['status']),hrReportPick(o,['reviewed_by','approved_by']),hrReportPick(o,['created_at'])]));
  return rows;
}
function hrReportAnnualLeaveSheet(data){
  const rows=[['員工編號','姓名','部門','到職日','離職日','特休總天數','已用','剩餘','使用期限','狀態']];
  data.employees.forEach(e=>rows.push([hrReportPick(e,['employee_no','emp_no']),hrReportPick(e,['name','employee_name']),hrReportPick(e,['department']),hrReportDate(e.hire_date),hrReportDate(e.termination_date),hrReportN(e.annual_leave_total),hrReportN(e.annual_leave_used),hrReportN(e.annual_leave_remaining),hrReportDate(e.annual_leave_expire_date),(e.is_active===false?'停用':'在職')]));
  return rows;
}
function hrReportAddSheet(wb, name, rows){
  const ws = XLSX.utils.aoa_to_sheet(rows || []);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
}
window.previewHrReportCounts = async function(){
  try{ initHrReportFilters(); const d = await hrReportLoadAllData();
    const attendanceInRange = d.attendance.filter(a=>hrReportInRange(hrReportAttendanceDate(a))).length;
    $('hrReportPreview').innerHTML = table(['資料表','總筆數','本次篩選'], [['員工',d.employees.length,'全部'],['薪資',d.payroll.length,d.payroll.filter(p=>hrReportInRange(p.created_at || p.payroll_month || p.month)).length],['打卡',d.attendance.length,attendanceInRange],['請假',d.leaveReq.length,d.leaveReq.filter(l=>hrReportInRange(l.start_date || l.leave_start || l.start_time || l.created_at)).length],['加班',d.overtime.length,d.overtime.filter(o=>hrReportInRange(o.overtime_date || o.date || o.created_at)).length]]);
    msg('報表筆數預覽完成。請確認年份/月分是否為匯入資料月份。');
  }catch(e){ console.error(e); msg('預覽失敗：'+(e.message||e),'bad'); }
};
window.exportHrFullExcelReport = async function(){
  try{
    initHrReportFilters();
    if(!window.XLSX){ msg('Excel 套件尚未載入，請重新整理後再試。','bad'); return; }
    const d = await hrReportLoadAllData();
    const wb = XLSX.utils.book_new();
    hrReportAddSheet(wb,'儀表總覽',hrReportOverviewSheet(d));
    hrReportAddSheet(wb,'員工資料',hrReportEmployeesSheet(d));
    hrReportAddSheet(wb,'薪資總表',hrReportPayrollSheet(d));
    hrReportAddSheet(wb,'打卡明細',hrReportAttendanceSheet(d));
    hrReportAddSheet(wb,'請假明細',hrReportLeaveSheet(d));
    hrReportAddSheet(wb,'加班明細',hrReportOvertimeSheet(d));
    hrReportAddSheet(wb,'特休明細',hrReportAnnualLeaveSheet(d));
    const ymd = new Date().toISOString().slice(0,10).replaceAll('-','');
    XLSX.writeFile(wb, `沛鴻_HR完整總報表_${hrReportPeriodLabel()}_${ymd}.xlsx`);
    msg('完整總報表 Excel 已產生。');
  }catch(e){ console.error(e); msg('匯出失敗：'+(e.message||e),'bad'); }
};


// ===== V38 出缺勤統計中心：只讀資料，不修改既有出勤/薪資/請假/加班 =====
let lastAttendanceStatsRows = null;
function statsMinuteOfDay(ts){
  const t = timeOnlyFromTs(ts);
  const m = String(t||'').match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  return Number(m[1])*60 + Number(m[2]);
}
function statsDateFromAttendance(a){ return hrReportAttendanceDate(a); }
function statsAttendanceLateMinutes(a){
  const d = statsDateFromAttendance(a); if(!d || !a.check_in) return 0;
  const min = statsMinuteOfDay(a.check_in); if(min === null) return 0;
  return Math.max(0, min - 9*60);
}
function statsAttendanceEarlyMinutes(a){
  const d = statsDateFromAttendance(a); if(!d || !a.check_out) return 0;
  const min = statsMinuteOfDay(a.check_out); if(min === null) return 0;
  return Math.max(0, 17*60 - min);
}
function statsLeaveTypeKey(t){
  const s = String(t||'其他').trim();
  if(s.includes('事假')) return '事假';
  if(s.includes('病假')) return '病假';
  if(s.includes('特休')) return '特休';
  if(s.includes('公假')) return '公假';
  if(s.includes('曠職')) return '曠職';
  return s || '其他';
}
function statsApprovedRows(rows){ return (rows||[]).filter(x => isApprovedStatus ? isApprovedStatus(x.status) : ['approved','核准','已核准'].includes(String(x.status||''))); }
function buildAttendanceStatsRows(data){
  const emps = (data.employees||[]).slice().sort((a,b)=>String(a.employee_no||'').localeCompare(String(b.employee_no||''),'zh-Hant'));
  const attInRange = (data.attendance||[]).filter(a=>hrReportInRange(statsDateFromAttendance(a)));
  const leaveInRange = statsApprovedRows((data.leaveReq||[]).filter(l=>hrReportInRange(l.start_date || l.leave_start || l.start_time || l.created_at)));
  const otInRange = statsApprovedRows((data.overtime||[]).filter(o=>hrReportInRange(o.overtime_date || o.date || o.created_at)));
  const byEmp = new Map(emps.map(e=>[String(e.id), {
    id:e.id, employee_no:hrReportPick(e,['employee_no','emp_no']), name:hrReportPick(e,['name','employee_name']), department:hrReportPick(e,['department']),
    attendanceDays:new Set(), checkInMissing:0, checkOutMissing:0, lateCount:0, lateMinutes:0, earlyCount:0, earlyMinutes:0,
    autoOtHours:0, approvedOtHours:0, totalOtHours:0, leaveHours:{}, leaveTotalHours:0, absentHours:0
  }]));
  for(const a of attInRange){
    const id = String(a.employee_id||''); if(!byEmp.has(id)) continue;
    const row = byEmp.get(id); const d = statsDateFromAttendance(a); if(d) row.attendanceDays.add(d);
    if(!a.check_in) row.checkInMissing += 1;
    if(!a.check_out) row.checkOutMissing += 1;
    const late = statsAttendanceLateMinutes(a); if(late>0){ row.lateCount += 1; row.lateMinutes += late; }
    const early = statsAttendanceEarlyMinutes(a); if(early>0){ row.earlyCount += 1; row.earlyMinutes += early; }
  }
  const approvedOtDatesByEmp = new Map();
  for(const o of otInRange){
    const id = String(o.employee_id||''); if(!byEmp.has(id)) continue;
    const hrs = hrReportN(o.overtime_hours||o.total_hours||o.calculated_hours);
    byEmp.get(id).approvedOtHours += hrs;
    const od = hrReportDate(o.overtime_date||o.date);
    if(od){ if(!approvedOtDatesByEmp.has(id)) approvedOtDatesByEmp.set(id,new Set()); approvedOtDatesByEmp.get(id).add(od); }
  }
  for(const a of attInRange){
    const id = String(a.employee_id||''); if(!byEmp.has(id)) continue;
    const d = statsDateFromAttendance(a); if(!d || !a.check_out) continue;
    if(approvedOtDatesByEmp.get(id)?.has(d)) continue;
    byEmp.get(id).autoOtHours += calcAutoOvertimeHoursFromCheckout(d, a.check_out);
  }
  for(const l of leaveInRange){
    const id = String(l.employee_id||''); if(!byEmp.has(id)) continue;
    const key = statsLeaveTypeKey(l.leave_type || l.type);
    const hrs = hrReportN(l.leave_hours||l.hours||l.total_hours) || leaveHours(l.start_date || l.leave_start || l.start_time, l.end_date || l.leave_end || l.end_time);
    const row = byEmp.get(id); row.leaveHours[key] = round2(hrReportN(row.leaveHours[key]) + hrs); row.leaveTotalHours += hrs;
    if(key === '曠職') row.absentHours += hrs;
  }
  const rows = Array.from(byEmp.values()).map(r=>{
    r.attendanceDayCount = r.attendanceDays.size;
    r.autoOtHours = round2(r.autoOtHours); r.approvedOtHours = round2(r.approvedOtHours);
    r.totalOtHours = round2(r.autoOtHours + r.approvedOtHours);
    r.leaveTotalHours = round2(r.leaveTotalHours); r.absentHours = round2(r.absentHours);
    return r;
  });
  return rows;
}
function attendanceStatsSheetRows(rows){
  const leaveTypes = Array.from(new Set(rows.flatMap(r=>Object.keys(r.leaveHours||{}))));
  const header = ['員工編號','姓名','部門','出勤天數','遲到次數','遲到總分鐘','早退次數','早退總分鐘','缺上班卡','缺下班卡','自動加班時數','核准加班時數','加班總時數','請假總小時','曠職小時',...leaveTypes.map(t=>t+'小時')];
  return [header, ...rows.map(r=>[r.employee_no,r.name,r.department,r.attendanceDayCount,r.lateCount,r.lateMinutes,r.earlyCount,r.earlyMinutes,r.checkInMissing,r.checkOutMissing,r.autoOtHours,r.approvedOtHours,r.totalOtHours,r.leaveTotalHours,r.absentHours,...leaveTypes.map(t=>hrReportN(r.leaveHours[t]))])];
}
function attendanceStatsDetailRows(data){
  const rows=[['類型','日期','員工編號','姓名','說明','分鐘/小時','來源']];
  const empNo = id => hrReportEmpNo(data.empMap,id); const empName = id => hrReportEmpName(data.empMap,id);
  (data.attendance||[]).filter(a=>hrReportInRange(statsDateFromAttendance(a))).forEach(a=>{
    const d = statsDateFromAttendance(a); const late=statsAttendanceLateMinutes(a); const early=statsAttendanceEarlyMinutes(a); const autoOt=calcAutoOvertimeHoursFromCheckout(d,a.check_out);
    if(late>0) rows.push(['遲到',d,empNo(a.employee_id),empName(a.employee_id),`上班 ${hrReportPick(a,['check_in'])}`,late,'打卡']);
    if(early>0) rows.push(['早退',d,empNo(a.employee_id),empName(a.employee_id),`下班 ${hrReportPick(a,['check_out'])}`,early,'打卡']);
    if(autoOt>0) rows.push(['自動加班',d,empNo(a.employee_id),empName(a.employee_id),`下班 ${hrReportPick(a,['check_out'])}`,autoOt,'下班打卡']);
    if(!a.check_in) rows.push(['缺上班卡',d,empNo(a.employee_id),empName(a.employee_id),'缺上班打卡','', '打卡']);
    if(!a.check_out) rows.push(['缺下班卡',d,empNo(a.employee_id),empName(a.employee_id),'缺下班打卡','', '打卡']);
  });
  statsApprovedRows(data.leaveReq||[]).filter(l=>hrReportInRange(l.start_date || l.leave_start || l.start_time || l.created_at)).forEach(l=>{
    const hrs = hrReportN(l.leave_hours||l.hours||l.total_hours) || leaveHours(l.start_date || l.leave_start || l.start_time, l.end_date || l.leave_end || l.end_time);
    rows.push(['請假',hrReportDate(l.start_date||l.leave_start||l.start_time),empNo(l.employee_id),empName(l.employee_id),statsLeaveTypeKey(l.leave_type||l.type),round2(hrs),'請假單']);
  });
  statsApprovedRows(data.overtime||[]).filter(o=>hrReportInRange(o.overtime_date || o.date || o.created_at)).forEach(o=>{
    rows.push(['核准加班',hrReportDate(o.overtime_date||o.date),empNo(o.employee_id),empName(o.employee_id),hrReportPick(o,['reason'],''),hrReportN(o.overtime_hours||o.total_hours||o.calculated_hours),'加班單']);
  });
  return rows;
}
window.generateAttendanceStatsCenter = async function(){
  try{
    initHrReportFilters();
    const data = await hrReportLoadAllData();
    const rows = buildAttendanceStatsRows(data);
    lastAttendanceStatsRows = {rows, data};
    const display = rows.map(r=>[r.employee_no,r.name,r.department||'-',r.attendanceDayCount,r.lateCount,r.lateMinutes,r.earlyCount,r.earlyMinutes,r.totalOtHours,r.leaveTotalHours,r.checkInMissing,r.checkOutMissing]);
    $('hrReportPreview').innerHTML = '<h3>V38 出缺勤統計總覽｜'+hrReportPeriodLabel()+'</h3>' + table(['員編','姓名','部門','出勤天數','遲到次數','遲到分鐘','早退次數','早退分鐘','加班總時數','請假小時','缺上班卡','缺下班卡'], display);
    msg('出缺勤統計已產生，可直接匯出Excel。');
  }catch(e){ console.error(e); msg('出缺勤統計失敗：'+(e.message||e),'bad'); }
};
window.exportAttendanceStatsCenter = async function(){
  try{
    initHrReportFilters();
    const pack = lastAttendanceStatsRows || {data: await hrReportLoadAllData()};
    const data = pack.data; const rows = pack.rows || buildAttendanceStatsRows(data);
    if(!window.XLSX){ msg('Excel 套件尚未載入，請重新整理後再試。','bad'); return; }
    const wb = XLSX.utils.book_new();
    hrReportAddSheet(wb,'出缺勤統計總覽',attendanceStatsSheetRows(rows));
    hrReportAddSheet(wb,'出缺勤明細',attendanceStatsDetailRows(data));
    const ymd = new Date().toISOString().slice(0,10).replaceAll('-','');
    XLSX.writeFile(wb, `沛鴻_出缺勤統計_${hrReportPeriodLabel()}_${ymd}.xlsx`);
    msg('出缺勤統計 Excel 已產生。');
  }catch(e){ console.error(e); msg('匯出出缺勤統計失敗：'+(e.message||e),'bad'); }
};

// 初始化報表篩選，若 HR 後台尚未顯示也不影響
setTimeout(initHrReportFilters, 500);
