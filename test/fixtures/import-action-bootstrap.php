<?php
/** Isolated fixture: actual application code, fictional records, SMTP captured before any network call. */
$root = dirname(__DIR__,2);
$box = $argv[1];
if (!is_dir($box)) mkdir($box,0700,true);
foreach (['import_action_reminders.php','import_action_template.php','import_actions_api.php','operador_usa.php','inspection_upload_followup.php','inspection_upload_template.php','inspection_price_followup.php','inspection_price_template.php','eleccion_lancha.php','auth_helper.php','cors_helper.php','email_service.php','payment_receipts.php','payment_receipts_api.php','payment_requests_api.php'] as $f) copy("$root/api/$f","$box/$f");
mkdir("$box/email-assets",0700,true);
copy("$root/api/email-assets/firma-jp.jpg","$box/email-assets/firma-jp.jpg");
file_put_contents("$box/db_config.php", '<?php
define("IMPORLAN_ADMIN_EMAIL","owner@example.test"); define("JWT_SECRET","fixture-import-secret");
ini_set("error_log","/dev/null");
function getDbConnection() { if (isset($GLOBALS["db"])) return $GLOBALS["db"]; $p=new PDO("sqlite:".__DIR__."/fixture.sqlite"); $p->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION); $p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC); return $p; }
');
$source=file_get_contents("$box/email_service.php");
$marker='private function sendViaSMTP($to, $subject, $body, $headers, $ccEmail = null, $bccEmails = []) {';
if (strpos($source,$marker)===false) throw new RuntimeException('SMTP fixture marker changed');
$source=str_replace($marker,$marker.' $capture=compact("to","subject","body","headers","ccEmail","bccEmails"); $GLOBALS["ACTION_SMTP"][]=$capture; file_put_contents(__DIR__."/captured.jsonl",json_encode($capture)."\n",FILE_APPEND); return ["success"=>true];',$source);
file_put_contents("$box/email_service.php",$source);
file_put_contents("$box/config.php",'<?php function setCorsHeaders() {}');
require "$box/import_action_reminders.php";
$db=getDbConnection();
$db->exec('CREATE TABLE orders (id INTEGER PRIMARY KEY,order_number TEXT,customer_name TEXT,customer_email TEXT,status TEXT,visible_to_client INT,chosen_link_id INT,chosen_inspection INT,import_steps TEXT,inspection_result TEXT,inspection_report_at TEXT,inspection_client_ok_at TEXT,refund_requested_at TEXT,usa_requested_at TEXT,usa_updated_at TEXT)');
$db->exec("INSERT INTO orders VALUES(1,'IMP-DEMO','Cliente Ejemplo','client@example.test','in_progress',1,11,1,'{}',NULL,'2026-10-28 12:00:00','2026-10-29 12:00:00',NULL,NULL,NULL)");
$db->exec('CREATE TABLE order_links (id INTEGER PRIMARY KEY,order_id INT,title TEXT,quote_published_at TEXT,quote_total_clp INT,quote_total_usd INT,quote_payments TEXT)');
$db->exec("INSERT INTO order_links VALUES(11,1,'Embarcación de ejemplo','2026-10-20 12:00:00',42685440,46000,'{\"p1_clp\":2987981,\"p1_pct\":7,\"p2_clp\":26891827,\"p2_pct\":63,\"p3_clp\":12805632,\"p3_pct\":30}')");
$db->exec('CREATE TABLE order_client_data (order_id INTEGER PRIMARY KEY,data TEXT,ci_front_id INT,ci_back_id INT,terms_version TEXT,terms_accepted_at TEXT)');
file_put_contents("$box/payment_requests.json",json_encode(['requests'=>[['id'=>'fixture-p2','user_email'=>'client@example.test','title'=>'Pago 2','status'=>'pending','amount_clp'=>26891827,'metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>2]]],['id'=>'fixture-p1','user_email'=>'client@example.test','title'=>'Pago 1','status'=>'paid','amount_clp'=>2987981,'metadata'=>['order_id'=>'IMP-DEMO','custom_fields'=>['pago'=>1]]]]]));
