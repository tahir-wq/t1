const menuToggle=document.querySelector("#menuToggle");
const siteNav=document.querySelector("#siteNav");
const scrollProgress=document.querySelector("#scrollProgress");
const year=document.querySelector("#year");
const assistantOpen=document.querySelector("#assistantOpen");
const assistantPanel=document.querySelector("#assistantPanel");
const assistantBackdrop=document.querySelector("#assistantBackdrop");
const assistantClose=document.querySelector("#assistantClose");
const assistantMessages=document.querySelector("#assistantMessages");
const assistantStatus=document.querySelector("#assistantStatus");
const assistantForm=document.querySelector("#assistantForm");
const assistantInput=document.querySelector("#assistantInput");
const assistantLanguage=document.querySelector("#assistantLanguage");
const assistantSend=document.querySelector("#assistantSend");
const ASSISTANT_API_URL="http://127.0.0.1:8788";

year.textContent=new Date().getFullYear();

function getConversationId(){
  const key="portfolioAssistantConversationId";
  let conversationId=sessionStorage.getItem(key);
  if(!conversationId){
    conversationId=crypto.randomUUID();
    sessionStorage.setItem(key,conversationId);
  }
  return conversationId;
}

const conversationId=getConversationId();
let assistantHistoryLoaded=false;
let assistantHistoryPromise=null;
let assistantBusy=false;
let previousBodyOverflow="";

function addAssistantMessage(role,content){
  const message=document.createElement("div");
  message.className=`assistant-message assistant-message--${role}`;
  message.textContent=content;
  assistantMessages.append(message);
  assistantMessages.scrollTop=assistantMessages.scrollHeight;
}

async function requestAssistant(path,options){
  const response=await fetch(`${ASSISTANT_API_URL}${path}`,{
    ...options,
    credentials:"omit",
    headers:options?.body?{"Content-Type":"application/json",...options.headers}:options?.headers,
  });
  let data;
  try{
    data=await response.json();
  }catch{
    throw new Error(`The AI service returned an unreadable response (HTTP ${response.status}).`);
  }
  if(!response.ok)throw new Error(data.error||`The AI service returned HTTP ${response.status}.`);
  return data;
}

async function loadAssistantHistory(){
  if(assistantHistoryLoaded)return;
  if(assistantHistoryPromise)return assistantHistoryPromise;
  assistantHistoryPromise=(async()=>{
    try{
      const data=await requestAssistant(`/api/chat/history?conversation_id=${encodeURIComponent(conversationId)}`,{});
      if(data.messages.length){
        assistantMessages.replaceChildren();
        data.messages.forEach(message=>addAssistantMessage(message.role,message.content));
      }
      assistantHistoryLoaded=true;
      assistantStatus.textContent="";
    }catch(error){
      assistantStatus.textContent=`AI unavailable: ${error.message} Start Ollama and the assistant server to chat.`;
    }finally{
      assistantHistoryPromise=null;
    }
  })();
  return assistantHistoryPromise;
}

function openAssistant(){
  assistantPanel.inert=false;
  assistantPanel.setAttribute("aria-hidden","false");
  assistantPanel.classList.add("is-open");
  assistantBackdrop.hidden=false;
  requestAnimationFrame(()=>assistantBackdrop.classList.add("is-open"));
  previousBodyOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  assistantInput.focus();
  loadAssistantHistory();
}

function closeAssistant(){
  assistantPanel.classList.remove("is-open");
  assistantPanel.setAttribute("aria-hidden","true");
  assistantPanel.inert=true;
  assistantBackdrop.classList.remove("is-open");
  window.setTimeout(()=>{
    if(!assistantPanel.classList.contains("is-open"))assistantBackdrop.hidden=true;
  },350);
  document.body.style.overflow=previousBodyOverflow;
  (assistantOpen.getClientRects().length?assistantOpen:menuToggle).focus();
}

assistantOpen.addEventListener("click",openAssistant);
assistantClose.addEventListener("click",closeAssistant);
assistantBackdrop.addEventListener("click",closeAssistant);
assistantInput.addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){
    event.preventDefault();
    assistantForm.requestSubmit();
  }
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&assistantPanel.classList.contains("is-open"))closeAssistant();
  if(event.key==="Tab"&&assistantPanel.classList.contains("is-open")){
    const focusable=[assistantClose,assistantLanguage,assistantInput,assistantSend];
    const first=focusable[0];
    const last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});

assistantForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const message=assistantInput.value.trim();
  if(!message||assistantBusy)return;
  assistantInput.value="";
  addAssistantMessage("user",message);
  assistantBusy=true;
  assistantSend.disabled=true;
  assistantStatus.textContent="Thinking…";
  try{
    const data=await requestAssistant("/api/chat",{
      method:"POST",
      body:JSON.stringify({message,language:assistantLanguage.value,conversation_id:conversationId}),
    });
    addAssistantMessage("assistant",data.answer);
    assistantStatus.textContent="";
  }catch(error){
    assistantStatus.textContent=`Could not get a reply: ${error.message}`;
  }finally{
    assistantBusy=false;
    assistantSend.disabled=false;
    assistantInput.focus();
  }
});

menuToggle.addEventListener("click",()=>{
  const isOpen=menuToggle.getAttribute("aria-expanded")==="true";
  menuToggle.setAttribute("aria-expanded",String(!isOpen));
  menuToggle.setAttribute("aria-label",isOpen?"Open navigation":"Close navigation");
  siteNav.classList.toggle("is-open",!isOpen);
});

siteNav.addEventListener("click",event=>{
  if(event.target.closest("a, #assistantOpen")){
    menuToggle.setAttribute("aria-expanded","false");
    menuToggle.setAttribute("aria-label","Open navigation");
    siteNav.classList.remove("is-open");
  }
});

let ticking=false;
window.addEventListener("scroll",()=>{
  if(ticking)return;
  ticking=true;
  window.requestAnimationFrame(()=>{
    const scrollable=document.documentElement.scrollHeight-window.innerHeight;
    const progress=scrollable>0?window.scrollY/scrollable*100:0;
    scrollProgress.style.transform=`scaleX(${progress/100})`;
    ticking=false;
  });
},{passive:true});

const revealItems=document.querySelectorAll(".reveal");
if("IntersectionObserver" in window){
  const observer=new IntersectionObserver((entries,activeObserver)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("is-visible");
        activeObserver.unobserve(entry.target);
      }
    });
  },{threshold:0.14,rootMargin:"0px 0px -36px 0px"});
  revealItems.forEach((item,index)=>{
    item.style.setProperty("--reveal-delay",`${(index%3)*90}ms`);
    observer.observe(item);
  });
}else{
  revealItems.forEach(item=>item.classList.add("is-visible"));
}
