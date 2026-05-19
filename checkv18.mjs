
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://mhsasrjpuottlmhsutnb.supabase.co', 'sb_publishable_2lGa4xcG6gxuFTYas0A0Bw_1I56RG5I');
let employees=[], selectedEmployee=null, currentGps=null;
const $=id=>document.getElementById(id);

let currentHrOk = sessionStorage.getItem('peihong_hr_login') === '1';
function hrLoginPrompt(){
  if(currentHrOk) return true;
  const acc = prompt('HR 後台帳號');
  if(acc === null) return false;
  const pw = prompt('HR 後台密碼');
  if(acc === 'admin' && pw === 'peihong2026'){
    currentHrOk = true;
    sessionStorage.setItem('peihong_hr_login','1');
    return true;
  }
  msg('HR 帳號或密碼錯誤','bad');
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
  msg('HR 已登出');
  showPage('home');
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
window.changeAdminPin = function(){
  if(!hrLoginPrompt()) return;
  const next = prompt('請輸入新的 HR 後台密碼');
  if(!next || next.length < 4) return msg('密碼至少 4 碼','bad');
  localStorage.setItem('peihong_admin_pin', next);
  msg('HR 後台密碼已更新');
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

window.showPage=async n=>{if(n==='admin'&&!hrLoginPrompt())return;document.querySelectorAll('.page').forEach(p=>p.classList.add('hide'));$('page-'+n).classList.remove('hide');if(n==='employee')await tryRestoreEmployeeLogin();if(n==='admin')await loadAdminAll()};

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
    if($('payEmpSelect')) { $('payEmpSelect').innerHTML = opts; updatePayrollHourlyRate(); }
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
    salary:Number($('newEmpSalary').value||0),
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
  $('editEmpLogin').value = e.login_account || e.employee_no || '';
  $('editEmpPassword').value = e.login_password || '';
  $('editEmpSalary').value = e.salary || 0;
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
    login_account: $('editEmpLogin').value.trim() || $('editEmpNo').value.trim(),
    login_password: $('editEmpPassword').value.trim(),
    salary: Number($('editEmpSalary').value || 0),
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
  const autoIns = calculateInsuranceFromWageBase(wageBase, updated.health_dependents_count);
  const r = await supabase.from('employees').update({
    salary: updated.salary,
    labor_insured_salary: autoIns.laborInsured,
    health_insured_salary: autoIns.healthInsured,
    labor_insurance: autoIns.laborEmployee,
    health_insurance: autoIns.healthSelf,
    dependent_health_insurance: autoIns.depHealth
  }).eq('id', id);
  if(r.error) return msg('月薪修改失敗：' + r.error.message, 'bad');
  msg(`月薪已更新；工資基礎 $${money(wageBase)}，勞保級距 ${money(autoIns.laborInsured)}，健保級距 ${money(autoIns.healthInsured)}`);
  await loadAdminAll();
}


async function loadEmployeeTable(){
  await loadEmployees();
  if(!employees.length){
    if($('employeeTable')) $('employeeTable').innerHTML = '<div class="warn">目前沒有員工資料。請先新增員工，或檢查 Supabase employees 表。</div>';
    return;
  }
  $('employeeTable').innerHTML = table(
    ['編號','姓名','帳號','密碼','部門','職稱','本薪','工資基礎','勞保級距','健保級距','勞健保眷屬','狀態','操作'],
    employees.map(e => [
      e.employee_no || '-',
      e.name || '-',
      e.login_account || e.employee_no || '-',
      e.login_password ? '已設定' : '未設定',
      e.department || '-',
      e.position || '-',
      '$' + money(e.salary),
      '$' + money(employeeWageBase(e)),
      money(e.labor_insured_salary || bracketAmount(employeeWageBase(e), laborBrackets)),
      money(e.health_insured_salary || bracketAmount(employeeWageBase(e), healthBrackets)),
      '$' + money(Number(e.labor_insurance||0) + Number(e.health_insurance||0) + Number(e.dependent_health_insurance||0)),
      e.is_active === false ? '停用' : '在職',
      `<button onclick="editEmployee('${e.id}')">編輯</button><button class="btn2" onclick="quickSalaryEdit('${e.id}')">快速改薪</button><button class="btnRed" onclick="deleteEmployee('${e.id}')">刪除</button>`
    ])
  );
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
  holiday_within8:'國定假日8小時內',
  holiday_after8_first2:'國定假日超過8小時-前2小時',
  holiday_after8_after2:'國定假日超過8小時-後2小時',
  regular_emergency:'例假日緊急出勤',
  regular_after8_first2:'例假日超過8小時-前2小時',
  regular_after8_after2:'例假日超過8小時-後2小時'
};
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
function calculateInsuranceFromWageBase(wageBase, dependentsCount=0){
  const laborInsured = bracketAmount(wageBase, laborBrackets);
  const healthInsured = bracketAmount(wageBase, healthBrackets);
  const laborEmployee = round0(laborInsured * payrollSettings.laborRate * payrollSettings.laborEmployeeShare);
  const healthSelf = round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare);
  const depCount = Math.min(num(dependentsCount), 3);
  const depHealth = round0(healthInsured * payrollSettings.healthRate * payrollSettings.healthEmployeeShare * depCount);
  return { laborInsured, healthInsured, laborEmployee, healthSelf, depCount, depHealth, healthTotal: healthSelf + depHealth };
}
function collectEmployeeForm(prefix){
  const get = id => $(prefix + id);
  return {
    salary: num(get('Salary')?.value),
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
  const ins = calculateInsuranceFromWageBase(wageBase, emp.health_dependents_count);
  const laborInput = $(prefix + 'Labor');
  const healthInput = $(prefix + 'Health');
  const depInput = $(prefix + 'DepHealth');
  if(laborInput) laborInput.value = ins.laborEmployee;
  if(healthInput) healthInput.value = ins.healthSelf;
  if(depInput) depInput.value = ins.depHealth;
  const preview = $(prefix + 'InsurancePreview');
  if(preview){
    preview.innerHTML = `工資基礎：$${money(wageBase)}｜加班時薪：$${money(round2(wageBase / payrollSettings.monthlyHours))}<br>勞保級距：${money(ins.laborInsured)}，員工勞保：$${money(ins.laborEmployee)}｜健保級距：${money(ins.healthInsured)}，本人健保：$${money(ins.healthSelf)}，眷屬健保：$${money(ins.depHealth)}`;
  }
  return { wageBase, ...ins };
}
function attachInsuranceAutoSync(prefix){
  ['Salary','Meal','PositionAllowance','Fuel','FixedBonus','OtherFixed','Dependents'].forEach(k=>{
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
  const laborInsured = num(emp.labor_insured_salary) || bracketAmount(wageBase, laborBrackets);
  const healthInsured = num(emp.health_insured_salary) || bracketAmount(wageBase, healthBrackets);
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
function leaveHours(start, end){
  if(!start || !end) return 0;
  const s = new Date(String(start).replace(' ', 'T'));
  const e = new Date(String(end).replace(' ', 'T'));
  if(isNaN(s) || isNaN(e) || e <= s) return 0;
  return Math.round(((e-s)/3600000)*100)/100;
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
  const start = month + '-01';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  const r = await supabase.from('leave_requests')
    .select('*')
    .eq('employee_id', empId)
    .eq('status','approved')
    .gte('start_date', start)
    .lt('start_date', end);
  if(r.error) throw new Error('核准請假讀取失敗：' + r.error.message);
  const daySalary = Number(baseSalary||0) / daysInMonth(month);
  const hourSalary = daySalary / 8;
  let total = 0;
  const details = [];
  for(const row of (r.data||[])){
    const hrs = leaveHours(row.start_date, row.end_date);
    const rate = getLeaveDeductionRate(row.leave_type);
    const amount = Math.round(hrs * hourSalary * rate * 100) / 100;
    total += amount;
    details.push({type:row.leave_type, hours:hrs, rate, amount});
  }
  return {amount: Math.round(total*100)/100, details, rows:r.data||[]};
}

function calcHours(date, start, end){
  if(!date || !start || !end) return 0;
  const s = new Date(`${date}T${start}:00`);
  let e = new Date(`${date}T${end}:00`);
  if(e <= s) e = new Date(e.getTime() + 24*60*60*1000);
  return Math.round(((e - s) / 3600000) * 100) / 100;
}
window.submitOvertime = async function(){
  if(!selectedEmployee) return msg('請先登入員工','bad');
  const date = $('otDate')?.value;
  const start = $('otStart')?.value;
  const end = $('otEnd')?.value;
  const reason = $('otReason')?.value || '';
  const overtimeType = $('otType')?.value || 'weekday_first2';
  const hours = calcHours(date, start, end);
  if(!date || !start || !end || hours <= 0) return msg('請填寫正確加班日期與時間','bad');

  const payload = {
    employee_id: selectedEmployee.id,
    overtime_date: date,
    start_time: start,
    end_time: end,
    overtime_hours: hours,
    overtime_type: overtimeType,
    reason,
    status: 'pending'
  };

  const r = await supabase.from('overtime_requests').insert(payload).select('*').single();
  if(r.error) return msg('加班申請失敗：' + r.error.message + '。請確認已執行 V13 必跑SQL。','bad');

  msg(`加班申請已送出，共 ${hours} 小時，等待 HR 審核`);
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
  $('myOvertime').innerHTML = table(['日期','類型','時間','時數','原因','狀態'], (r.data||[]).map(x => [
    x.overtime_date || '-',
    overtimeTypeLabels[x.overtime_type] || '平日前2小時',
    `${String(x.start_time||'').slice(0,5)}~${String(x.end_time||'').slice(0,5)}`,
    x.overtime_hours || 0,
    x.reason || '-',
    x.status || 'pending'
  ]));
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
  $('overtimeTable').innerHTML = table(['員工','日期','類型','時間','時數','原因','狀態','操作'], (r.data||[]).map(x => [
    (x.employees?.employee_no||'') + ' ' + (x.employees?.name||''),
    x.overtime_date || '-',
    overtimeTypeLabels[x.overtime_type] || '平日前2小時',
    `${String(x.start_time||'').slice(0,5)}~${String(x.end_time||'').slice(0,5)}`,
    x.overtime_hours || 0,
    x.reason || '-',
    x.status || 'pending',
    (x.status || 'pending') === 'pending'
      ? `<button onclick="reviewOvertime('${x.id}','approved')">核准</button><button class="btnRed" onclick="reviewOvertime('${x.id}','rejected')">退回</button><button class="btnRed" onclick="deleteOvertime('${x.id}')">刪除</button>`
      : `已處理<button class="btnRed" onclick="deleteOvertime('${x.id}')">刪除</button>`
  ]));
}
window.reviewOvertime = async function(id, status){
  if(!hrLoginPrompt()) return;
  const r = await supabase.from('overtime_requests').update({status}).eq('id', id);
  if(r.error) return msg('加班審核失敗：' + r.error.message,'bad');
  msg(status === 'approved' ? '加班已核准' : '加班已退回');
  await loadOvertimeTable();
}

async function getApprovedOvertimeBreakdown(empId, month, hourlyRate){
  const start = month + '-01';
  const endDate = new Date(month + '-01');
  endDate.setMonth(endDate.getMonth()+1);
  const end = endDate.toISOString().slice(0,10);
  const r = await supabase.from('overtime_requests')
    .select('*')
    .eq('employee_id', empId)
    .eq('status','approved')
    .gte('overtime_date', start)
    .lt('overtime_date', end);
  if(r.error) throw new Error('核准加班讀取失敗：' + r.error.message + '。請先執行 V16_必跑SQL.txt');

  const hours = {
    weekday_first2:0, weekday_after2:0, rest_first2:0, rest_3to8:0, rest_9to12:0,
    holiday_within8:0, holiday_after8_first2:0, holiday_after8_after2:0,
    regular_emergency:0, regular_after8_first2:0, regular_after8_after2:0
  };
  for(const row of (r.data||[])){
    const type = row.overtime_type || 'weekday_first2';
    hours[type] = num(hours[type]) + num(row.overtime_hours);
  }

  const pay = {
    weekday: round2(hourlyRate * (hours.weekday_first2*1.34 + hours.weekday_after2*1.67)),
    rest: round2(hourlyRate * (hours.rest_first2*1.34 + hours.rest_3to8*1.67 + hours.rest_9to12*2.67)),
    holiday: round2((hours.holiday_within8 > 0 ? hourlyRate * 8 : 0) + hourlyRate * (hours.holiday_after8_first2*1.34 + hours.holiday_after8_after2*1.67)),
    regular: round2(hourlyRate * (hours.regular_emergency*2 + hours.regular_after8_first2*1.34 + hours.regular_after8_after2*1.67))
  };
  const totalHours = Object.values(hours).reduce((a,b)=>a+num(b),0);
  const total = round2(pay.weekday + pay.rest + pay.holiday + pay.regular);
  return {hours, totalHours:round2(totalHours), pay, total, rows:r.data||[]};
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
    msg(`已依 Excel 加班分類帶入：${ot.totalHours} 小時，加班費 $${money(ot.total)}`);
  }catch(err){
    msg(err.message || String(err),'bad');
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
    payroll_detail: {extra,overtime,leaveDeduction,result}
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
          <tr><td>月薪/本薪</td><td>$${money(emp.salary)}</td></tr>
          <tr><td>工資基礎合計</td><td>$${money(result.wageBase)}</td></tr>
          <tr><td>加班時薪</td><td>$${money(result.hourly)}</td></tr>
          <tr><td>平日加班費</td><td>$${money(overtime.pay.weekday)}</td></tr>
          <tr><td>休息日加班費</td><td>$${money(overtime.pay.rest)}</td></tr>
          <tr><td>國定假日加班費</td><td>$${money(overtime.pay.holiday)}</td></tr>
          <tr><td>例假日加班費</td><td>$${money(overtime.pay.regular)}</td></tr>
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
  if(r.error) return msg(`${label}刪除失敗：` + r.error.message + '。請確認已執行 V18_必跑SQL.txt', 'bad');
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
    if(r.error) return msg(`刪除員工相關${tableName}資料失敗：` + r.error.message + '。請確認已執行 V18_必跑SQL.txt', 'bad');
  }
  const r = await supabase.from('employees').delete().eq('id', id);
  if(r.error) return msg('員工刪除失敗：' + r.error.message + '。請確認已執行 V18_必跑SQL.txt', 'bad');
  msg('員工與相關紀錄已刪除');
  await loadAdminAll();
}

async function loadPayrollTable(){let r=await supabase.from('payroll').select('*, employees(employee_no,name)').order('created_at',{ascending:false}).limit(100);if(r.error)return;$('payrollTable').innerHTML=table(['月份','員工','本薪','加班','津貼','扣款','勞健保眷屬','實發','操作'],(r.data||[]).map(p=>[p.payroll_month,(p.employees?.employee_no||'')+' '+(p.employees?.name||''),'$'+money(p.base_salary),'$'+money(p.overtime_pay),'$'+money(p.allowance),'$'+money(p.deductions),'$'+money(+p.labor_insurance+ +p.health_insurance+ +p.dependent_health_insurance),'$'+money(p.net_salary),`<button class="btnRed" onclick="deletePayroll('${p.id}')">刪除</button>`]))}
window.addEventListener('load',()=>{ loadEmployees().then(updatePayrollHourlyRate); attachInsuranceAutoSync('newEmp'); });
