
import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const money=(v:number|string|null|undefined)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const normalize=(s:string)=>s.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().trim();

const COMMANDS=[
  "Minha cota",
  "Meu rendimento de juros",
  "Meu limite",
  "Meu empréstimo",
  "Próxima parcela",
  "Chave Pix",
  "Meus números da rifa",
  "Minhas poltronas",
  "Comprovantes",
  "Regulamento",
  "Avisos"
];
const normalizedCommands=new Map(COMMANDS.map(c=>[normalize(c),c]));
const fallback="Esse assunto não faz parte das opções do Oliver Assistente. Em caso de dúvidas, fale com o administrativo.";

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método não permitido."},405);

  try{
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"").trim();
    if(!token)return json({error:"Sessão inválida."},401);

    const db=createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {auth:{persistSession:false}}
    );

    const {data:userData,error:userError}=await db.auth.getUser(token);
    const user=userData?.user;
    if(userError||!user)return json({error:"Sessão expirada."},401);

    const body=await req.json();
    const question=String(body?.question||"").trim();
    if(!question)return json({error:"Escolha uma opção do menu."},400);

    const command=normalizedCommands.get(normalize(question));
    const profileRes=await db.from("profiles").select("id,full_name,cotista_number,share_count,active").eq("id",user.id).maybeSingle();
    const profile=profileRes.data;
    if(!profile||!profile.active)return json({error:"Perfil indisponível."},403);

    const settingsRes=await db.from("fund_settings")
      .select("monthly_share_amount,pix_key,bank_name,bank_code,bank_agency,bank_account,pix_receiver_name")
      .eq("id",1).maybeSingle();
    const settings=settingsRes.data||{};

    let intent="fallback";
    let answer=fallback;

    if(command==="Minha cota"){
      intent="contribution";
      const year=new Date().getFullYear();
      const res=await db.from("monthly_contributions")
        .select("amount_paid,status,reference_month")
        .eq("member_id",user.id)
        .eq("status","confirmed")
        .gte("reference_month",year+"-01-01")
        .lte("reference_month",year+"-12-01");
      const total=(res.data||[]).reduce((s:number,r:any)=>s+Number(r.amount_paid||0),0);
      const shares=Number(profile.share_count||1);
      const monthly=Number(settings.monthly_share_amount||100)*shares;
      answer="Você possui "+shares+" cota"+(shares===1?"":"s")+". Valor mensal atual: "+money(monthly)+". Total confirmado em cotas em "+year+": "+money(total)+".";
    }else if(command==="Meu rendimento de juros"){
      intent="interest_yield";
      const year=new Date().getFullYear();
      const res=await db.from("interest_distributions")
        .select("amount")
        .eq("member_id",user.id)
        .eq("distribution_year",year)
        .eq("status","credited");
      const total=(res.data||[]).reduce((s:number,r:any)=>s+Number(r.amount||0),0);
      answer="Seu rendimento confirmado em "+year+" é "+money(total)+". O valor considera os rendimentos creditados da caixinha, incluindo juros recebidos e resultados aprovados das rifas, distribuídos conforme a quantidade de cotas.";
    }else if(command==="Meu limite"){
      intent="credit";
      const res=await db.from("member_credit_summary").select("credit_limit,used_credit,available_credit").eq("member_id",user.id).maybeSingle();
      const credit=res.data||{};
      answer="Seu limite calculado é "+money(credit.credit_limit)+". Utilizado: "+money(credit.used_credit)+". Disponível: "+money(credit.available_credit)+".";
    }else if(command==="Meu empréstimo"){
      intent="loan";
      const res=await db.from("loans").select("outstanding_amount,status").eq("member_id",user.id).in("status",["active","late"]);
      const loans=res.data||[];
      const total=loans.reduce((s:number,l:any)=>s+Number(l.outstanding_amount||0),0);
      answer=loans.length
        ?"Você possui "+loans.length+" empréstimo(s) em aberto. Saldo devedor total: "+money(total)+"."
        :"Você não possui empréstimo ativo ou em atraso.";
    }else if(command==="Próxima parcela"){
      intent="installment";
      const loansRes=await db.from("loans").select("id").eq("member_id",user.id).in("status",["active","late"]);
      const ids=(loansRes.data||[]).map((l:any)=>l.id);
      if(!ids.length){
        answer="Você não possui parcela pendente registrada.";
      }else{
        const res=await db.from("loan_installments")
          .select("due_date,total_amount,amount_paid,status")
          .in("loan_id",ids).eq("status","pending")
          .order("due_date",{ascending:true}).limit(1);
        const next=(res.data||[])[0];
        answer=next
          ?"Sua próxima parcela vence em "+new Date(next.due_date+"T12:00:00").toLocaleDateString("pt-BR")+". Saldo da parcela: "+money(Number(next.total_amount)-Number(next.amount_paid||0))+"."
          :"Você não possui parcela pendente registrada.";
      }
    }else if(command==="Chave Pix"){
      intent="pix";
      answer=settings.pix_key
        ?"Chave Pix oficial: "+settings.pix_key+". Titular: "+(settings.pix_receiver_name||"não informado")+". Banco: "+(settings.bank_name||"não informado")+". Após pagar, envie o comprovante em “Pagamentos e comprovantes”."
        :"A chave Pix ainda não foi cadastrada. Em caso de dúvidas, fale com o administrativo.";
    }else if(command==="Meus números da rifa"){
      intent="raffle";
      const res=await db.from("raffle_numbers")
        .select("activity_id,number,status,activities(title,status)")
        .eq("member_id",user.id).order("number");
      const open=(res.data||[]).filter((n:any)=>n.activities?.status==="open");
      if(!open.length){
        answer="Você não possui números vinculados a uma rifa aberta.";
      }else{
        const grouped=new Map();
        for(const n of open){
          const key=String(n.activity_id);
          const g=grouped.get(key)||{title:n.activities?.title||"Rifa",nums:[]};
          g.nums.push(Number(n.number)); grouped.set(key,g);
        }
        answer=Array.from(grouped.values()).map((g:any)=>g.title+": "+g.nums.map((n:number)=>String(n).padStart(2,"0")).join(", ")+".").join(" ");
      }
    }else if(command==="Minhas poltronas"){
      intent="trip";
      const res=await db.from("trip_seats")
        .select("seat_number,activity_id,activities(title,status)")
        .eq("member_id",user.id).order("seat_number");
      const open=(res.data||[]).filter((s:any)=>s.activities?.status==="open");
      if(!open.length){
        answer="Você não possui poltrona vinculada a passeio aberto.";
      }else{
        const grouped=new Map();
        for(const s of open){
          const key=String(s.activity_id);
          const g=grouped.get(key)||{title:s.activities?.title||"Passeio",seats:[]};
          g.seats.push(Number(s.seat_number)); grouped.set(key,g);
        }
        answer=Array.from(grouped.values()).map((g:any)=>g.title+": poltrona(s) "+g.seats.map((n:number)=>String(n).padStart(2,"0")).join(", ")+".").join(" ");
      }
    }else if(command==="Comprovantes"){
      intent="receipt";
      answer="Abra “Pagamentos e comprovantes”, selecione o pagamento e envie a foto ou PDF. O pagamento só fica confirmado após a conferência do administrativo.";
    }else if(command==="Regulamento"){
      intent="rules";
      answer="O regulamento está disponível em “Meu cadastro”. Para qualquer interpretação ou situação não prevista, fale com o administrativo.";
    }else if(command==="Avisos"){
      intent="notifications";
      const res=await db.from("member_notifications")
        .select("title,message").eq("member_id",user.id)
        .is("read_at",null).order("created_at",{ascending:false}).limit(5);
      const notifications=res.data||[];
      answer=notifications.length
        ?"Você tem "+notifications.length+" aviso(s): "+notifications.map((n:any)=>n.title+" — "+n.message).join(" | ")
        :"Você não possui avisos pendentes.";
    }

    await db.from("chatbot_messages").insert({
      member_id:user.id,question,intent,answer,escalated:!command
    });

    return json({answer,intent,quick_replies:COMMANDS});
  }catch(e){
    console.error(e);
    return json({error:"Não foi possível consultar agora. Em caso de dúvidas, fale com o administrativo."},500);
  }
});
