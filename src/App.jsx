import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import SleepAudioSynth from './audioSynth';

// Comforting sleep messages that rotate during blackout
const SLEEP_MESSAGES = [
  "눈을 부드럽게 감고, 깊은 호흡을 계속하세요.",
  "오늘 하루 정말 수고 많았습니다. 이제 다 내려놓으세요.",
  "들려오는 부드러운 소리에 마인드를 실어 보내세요.",
  "당신의 몸과 마음은 서서히 깊은 휴식 속으로 빠져듭니다.",
  "내일 걱정은 내일의 나에게 맡기고, 지금은 평온을 취하세요."
];

function App() {
  // Navigation & States
  const [screen, setScreen] = useState('dashboard'); // 'dashboard' | 'step1' | 'step2' | 'step3' | 'blackout' | 'morning'
  const [soundMix, setSoundMix] = useState({
    pad: 0.4,
    rain: 0.2,
    fire: 0.0,
    wind: 0.1
  });
  const [timerDuration, setTimerDuration] = useState(60); // Reservation timer minutes (1 to 720)
  const [streak, setStreak] = useState(5);
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [sleepSatisfaction, setSleepSatisfaction] = useState(null);
  const [sleepMusicDuration, setSleepMusicDuration] = useState(30); // Default sleep music playback: 30 minutes
  const [isLiteMode, setIsLiteMode] = useState(() => localStorage.getItem('sleep_rit_lite_mode') !== 'false'); // Default to true (Free tier)
  
  // Settings Modal & Dashboard Logs
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('sounds'); // 'sounds' | 'analytics'
  const [sleepLogs, setSleepLogs] = useState([]);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  
  // Custom Ritual Durations
  const [stretchDuration, setStretchDuration] = useState(15); // seconds per stretch: 10, 15, 20, 30
  const [breathCyclesMax, setBreathCyclesMax] = useState(3); // breathing cycles count: 3, 4, 6, 8
  
  // Sleep Reservation Timer
  const [isReserveActive, setIsReserveActive] = useState(false);
  const [reserveSecondsLeft, setReserveSecondsLeft] = useState(0);
  const [reserveTotalSeconds, setReserveTotalSeconds] = useState(0);
  const [showAutomationGuide, setShowAutomationGuide] = useState(false);
  const [showReservationStartModal, setShowReservationStartModal] = useState(false);
  
  // Ritual Step 1: Device Charge
  const [isChargerConnected, setIsChargerConnected] = useState(false);
  const [orientationSimulation, setOrientationSimulation] = useState(false); // Simulate face down for testing

  // Ritual Step 2: 4-7-8 Breathing
  const [breathPhase, setBreathPhase] = useState('ready'); // 'ready' | 'inhale' | 'hold' | 'exhale' | 'done'
  const [breathTimer, setBreathTimer] = useState(0);
  const [breathCycle, setBreathCycle] = useState(1);
  const breathIntervalRef = useRef(null);

  // Ritual Step 3: Tomorrow's To-Do List
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [isSavingTodos, setIsSavingTodos] = useState(false);

  // Ritual Step 2.5: AI Chatbot Coach
  const [chatMessages, setChatMessages] = useState([
    { sender: 'coach', text: '안녕하세요. 슬립릿 수면 코치입니다. 🕯️ 오늘 밤 잠들기 전 마음을 무겁게 하는 생각이나 고민이 있다면 편하게 적어주세요.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isCoachTyping, setIsCoachTyping] = useState(false);

  // Ritual Step 1.5: Offline Stretching Guide
  const [stretchIndex, setStretchIndex] = useState(0);
  const [stretchSecondsLeft, setStretchSecondsLeft] = useState(15);
  const [isStretchActive, setIsStretchActive] = useState(false);

  // Blackout (Sleep Mode) Screen
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);
  const [currentMessageIdx, setCurrentMessageIdx] = useState(0);
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState(false);
  
  // Audio reference
  const audioSynth = useRef(new SleepAudioSynth());
  const volumeTimeoutRef = useRef(null);
  const touchStartY = useRef(0);

  // Radial dial drag states & refs
  const dialRef = useRef(null);
  const [isDialDragging, setIsDialDragging] = useState(false);

  const handleDialMove = (clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    
    // Map angle to 1 - 720 minutes (12 hours)
    const pct = angle / (2 * Math.PI);
    const minutes = Math.round(pct * 719) + 1;
    setTimerDuration(Math.max(1, Math.min(720, minutes)));
  };

  const handleDialMouseDown = (e) => {
    setIsDialDragging(true);
    handleDialMove(e.clientX, e.clientY);
  };

  const handleDialTouchStart = (e) => {
    setIsDialDragging(true);
    handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDialDragging) {
        handleDialMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e) => {
      if (isDialDragging) {
        handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDialDragging(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDialDragging]);

  // Sleep Reservation Countdown
  useEffect(() => {
    let interval;
    if (isReserveActive && reserveSecondsLeft > 0) {
      interval = setInterval(() => {
        setReserveSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            triggerReservationAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isReserveActive, reserveSecondsLeft]);

  // Persist Lite Mode
  useEffect(() => {
    localStorage.setItem('sleep_rit_lite_mode', isLiteMode.toString());
  }, [isLiteMode]);

  const playReservationChime = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.4);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.55);
      });
    } catch (e) {
      console.warn("Audio Context alert blocked or failed", e);
    }
  };

  const triggerReservationAlarm = () => {
    triggerHaptic([300, 100, 300, 100, 300, 100, 500]);
    playReservationChime();
    setIsReserveActive(false);
    setShowReservationStartModal(false);
    if (isLiteMode) {
      setScreen('step1'); // Go straight to Charger/Isolation screen in Lite Mode
    } else {
      setScreen('step3'); // Force transition to Step 1 (Tomorrow's To-Do list screen)
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("⏰ 슬립릿 수면 예약 완료!", {
        body: "약속된 수면 의식 시간입니다. 모든 앱을 종료하고 스마트폰 디톡스를 시작하세요.",
        icon: "/favicon.ico"
      });
    }
  };

  const handleStartReservation = (minutes) => {
    triggerHaptic(80);
    const totalSecs = Math.round(minutes * 60);
    setReserveSecondsLeft(totalSecs);
    setReserveTotalSeconds(totalSecs);
    setIsReserveActive(true);
    
    // Only show guide modal for real scheduled timers (not instant 6s tests)
    if (minutes > 0.5) {
      setShowReservationStartModal(true);
    }
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const handleCancelReservation = () => {
    triggerHaptic(50);
    setIsReserveActive(false);
    setReserveSecondsLeft(0);
    setReserveTotalSeconds(0);
    setShowReservationStartModal(false);
  };

  const formatReserveTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remaining = secs % 60;
    
    const hStr = hrs > 0 ? `${hrs}시간 ` : '';
    const mStr = mins > 0 ? `${mins}분 ` : '';
    const sStr = `${remaining}초`;
    
    return `${hStr}${mStr}${sStr}`;
  };

  // Read initial stats from localStorage
  useEffect(() => {
    const storedStreak = localStorage.getItem('sleep_rit_streak');
    const storedMinutes = localStorage.getItem('sleep_rit_minutes');
    const storedTodos = localStorage.getItem('sleep_rit_todos');
    const storedLogs = localStorage.getItem('sleep_rit_logs');
    const storedMix = localStorage.getItem('sleep_rit_mix');
    const storedStretchDur = localStorage.getItem('sleep_rit_stretch_dur');
    const storedBreathCycles = localStorage.getItem('sleep_rit_breath_cycles');
    const storedMusicDur = localStorage.getItem('sleep_rit_music_dur');
    
    if (storedStreak) setStreak(parseInt(storedStreak, 10));
    if (storedMinutes) setTotalMinutes(parseInt(storedMinutes, 10));
    if (storedStretchDur) setStretchDuration(parseInt(storedStretchDur, 10));
    if (storedBreathCycles) setBreathCyclesMax(parseInt(storedBreathCycles, 10));
    if (storedMusicDur) setSleepMusicDuration(parseInt(storedMusicDur, 10));
    
    if (storedTodos) {
      try {
        setTodos(JSON.parse(storedTodos));
      } catch (e) {
        setTodos([
          { id: 1, text: '이불 정리하기 🛌', completed: false },
          { id: 2, text: '따뜻한 물 한 잔 마시기 💧', completed: false }
        ]);
      }
    } else {
      setTodos([
        { id: 1, text: '이불 정리하기 🛌', completed: false },
        { id: 2, text: '따뜻한 물 한 잔 마시기 💧', completed: false }
      ]);
    }

    if (storedLogs) {
      try {
        setSleepLogs(JSON.parse(storedLogs));
      } catch (e) {
        setSleepLogs([]);
      }
    } else {
      // Mock logs for onboarding visual demo
      const mockLogs = [];
      const today = new Date();
      for (let i = 20; i > 0; i--) {
        if (Math.random() > 0.3) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          mockLogs.push({
            date: d.toISOString().split('T')[0],
            duration: [15, 30, 45, 60, 90][Math.floor(Math.random() * 5)],
            quality: ['good', 'meh', 'bad'][Math.floor(Math.random() * 3)]
          });
        }
      }
      setSleepLogs(mockLogs);
      localStorage.setItem('sleep_rit_logs', JSON.stringify(mockLogs));
    }

    if (storedMix) {
      try {
        setSoundMix(JSON.parse(storedMix));
      } catch (e) {}
    }
  }, []);

  // Handle device orientation API (if mobile supports it)
  useEffect(() => {
    const handleOrientation = (e) => {
      // Check if device is flat face-down (beta close to 180 or -180, gamma close to 0)
      const beta = e.beta;
      const gamma = e.gamma;
      
      if (beta && (Math.abs(beta) > 165 || Math.abs(beta) < 15) && screen === 'step1') {
        // Detected laying down flat
        if (isChargerConnected) {
          // Trigger transition if charger is connected
          handleNextFromStep1();
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [screen, isChargerConnected]);

  // Breathing Guide Loop (4-7-8 Method)
  useEffect(() => {
    if (screen !== 'step2') {
      clearInterval(breathIntervalRef.current);
      setBreathPhase('ready');
      setBreathCycle(1);
      return;
    }

    if (breathPhase === 'ready') return;

    // Handle breath timer decrement
    breathIntervalRef.current = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          clearInterval(breathIntervalRef.current);
          // Transition to next breathing phase
          transitionBreathingPhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(breathIntervalRef.current);
  }, [screen, breathPhase, breathCycle]);

  // Helper to transition between inhale, hold, exhale phases
  const transitionBreathingPhase = () => {
    if (breathPhase === 'inhale') {
      setBreathPhase('hold');
      setBreathTimer(7);
      triggerHaptic(100); // feedback
    } else if (breathPhase === 'hold') {
      setBreathPhase('exhale');
      setBreathTimer(8);
      triggerHaptic(200); // feedback
    } else if (breathPhase === 'exhale') {
      if (breathCycle >= breathCyclesMax) {
        setBreathPhase('done');
        setBreathTimer(0);
      } else {
        setBreathCycle(c => c + 1);
        setBreathPhase('inhale');
        setBreathTimer(4);
        triggerHaptic(50);
      }
    }
  };

  const startBreathing = () => {
    setBreathPhase('inhale');
    setBreathTimer(4);
    setBreathCycle(1);
  };

  // Blackout timer & message rotation
  useEffect(() => {
    let countdownInterval;
    let messageInterval;

    if (screen === 'blackout') {
      // Initialize audio
      audioSynth.current.setVolume(volume);
      audioSynth.current.start();
      
      // Load individual channel mix volume levels immediately
      Object.keys(soundMix).forEach(channel => {
        if (isLiteMode) {
          // Lite Mode plays rain at 0.5, pad at 0.2, others at 0.0
          if (channel === 'rain') {
            audioSynth.current.setChannelVolume(channel, 0.5);
          } else if (channel === 'pad') {
            audioSynth.current.setChannelVolume(channel, 0.2);
          } else {
            audioSynth.current.setChannelVolume(channel, 0.0);
          }
        } else {
          audioSynth.current.setChannelVolume(channel, soundMix[channel]);
        }
      });

      // Start countdown
      setSecondsRemaining(sleepMusicDuration * 60);

      countdownInterval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            finishSleepRitual();
            return 0;
          }
          
          // Trigger fade-out 15 seconds before the end
          if (prev === 16) {
            audioSynth.current.fadeAndStop(15);
          }

          return prev - 1;
        });
      }, 1000);

      // Rotate sleep messages
      setIsMessageVisible(true);
      messageInterval = setInterval(() => {
        setIsMessageVisible(false);
        setTimeout(() => {
          setCurrentMessageIdx((prev) => (prev + 1) % SLEEP_MESSAGES.length);
          setIsMessageVisible(true);
        }, 800); // fade duration offset
      }, 8000);
    } else {
      audioSynth.current.stop();
    }

    return () => {
      clearInterval(countdownInterval);
      clearInterval(messageInterval);
    };
  }, [screen]);

  // Vibrate device if API is supported (haptic feedback)
  const triggerHaptic = (ms) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  // Action: Charge completes or simulated flip flat
  const handleNextFromStep1 = () => {
    triggerHaptic(150);
    if (isLiteMode) {
      setScreen('blackout');
    } else {
      setScreen('stretching');
      setStretchIndex(0);
      setStretchSecondsLeft(stretchDuration);
      setIsStretchActive(true);
    }
  };

  // Stretching countdown effect
  useEffect(() => {
    let interval;
    if (screen === 'stretching' && isStretchActive && stretchSecondsLeft > 0) {
      interval = setInterval(() => {
        setStretchSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleStretchTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, isStretchActive, stretchSecondsLeft, stretchIndex, stretchDuration]);

  const handleStretchTimerComplete = () => {
    triggerHaptic(120);
    if (stretchIndex < 2) {
      setStretchIndex(prev => prev + 1);
      setStretchSecondsLeft(stretchDuration);
    } else {
      setScreen('step2');
    }
  };

  const handleSkipStretching = () => {
    triggerHaptic(50);
    setScreen('step2');
  };

  // Action: Finish breathing
  const handleNextFromStep2 = () => {
    triggerHaptic(100);
    setScreen('blackout');
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    triggerHaptic(50);
    
    const userMsg = { sender: 'user', text: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsCoachTyping(true);

    // Simulate thinking delay
    setTimeout(() => {
      setIsCoachTyping(false);
      const coachResponse = getCoachResponse(userMsg.text);
      setChatMessages(prev => [...prev, { sender: 'coach', text: coachResponse }]);
      triggerHaptic(80);
    }, 1200);
  };

  const getCoachResponse = (userInput) => {
    const text = userInput.toLowerCase();
    const responses = {
      stress: [
        "오늘 정말 무거운 마음을 안고 애쓰셨군요. 그 무거운 스트레스는 침대 밖 테이블에 놓아둔 폰처럼 잠시 격리해 둘까요? 🕯️",
        "많이 복잡하고 답답하셨겠어요. 지금 이 공간만큼은 아무것도 책임지지 않고 그냥 쉬어가셔도 괜찮습니다. 편히 숨을 내쉬어 보세요. ✨"
      ],
      work: [
        "오늘 일은 여기까지입니다. 머릿속의 퇴근 버튼을 누르듯 마음의 업무도 완전히 종료해 볼게요. 내일 아침의 나를 위해 지금은 눈을 감아봐요. 🛌",
        "밀려드는 일 생각에 뇌가 아직 깨어있군요. 오늘은 더 고민해도 결론이 나지 않는 시간입니다. 이제 푹 쉴 자격이 충분합니다."
      ],
      anxious: [
        "불안하고 걱정스러운 마음이 드는 것은 자연스러운 일입니다. 걱정 마세요, 이 방은 지금 아주 안전하고 아늑하니까요. 🌙",
        "생각이 꼬리를 무는군요. 들리는 음악 소리에만 가만히 귀 기울여 보세요. 그 수많은 생각들이 흐르는 물에 띄워 보내듯 흘러갈 거예요."
      ],
      sad: [
        "오늘 속상하고 아픈 일이 있으셨나 봅니다. 털어내려 억지로 애쓰지 말고, 포근한 이불 속에 마음을 편안히 기대어 보세요. ❤️",
        "지친 당신의 하루에 위로를 보냅니다. 괜찮아요, 잠은 몸과 영혼을 자연스럽게 치유하는 놀라운 힘이 있습니다. 편히 누워 보세요."
      ],
      general: [
        "마음속 생각을 솔직하게 고백해 주셔서 기쁩니다. 당신이 나열한 짐들은 제가 여기 고스란히 맡아둘 테니 안심하고 숙면하러 가볼까요? ✨",
        "따뜻하게 경청하고 있습니다. 오늘 일어난 일들은 이미 다 지나갔습니다. 당신에겐 지금 깊은 잠을 잘 온전한 권리가 있습니다. 🕯️",
        "충분히 잘해냈습니다. 긴장된 머릿속을 비우고, 들려오는 수면 믹서 멜로디에 몸을 맡겨 보세요. 잘 자요. 🌙"
      ]
    };

    if (text.includes('스트레스') || text.includes('짜증') || text.includes('화') || text.includes('힘들')) {
      return responses.stress[Math.floor(Math.random() * responses.stress.length)];
    }
    if (text.includes('일') || text.includes('회사') || text.includes('공부') || text.includes('업무') || text.includes('시험')) {
      return responses.work[Math.floor(Math.random() * responses.work.length)];
    }
    if (text.includes('걱정') || text.includes('불안') || text.includes('무서') || text.includes('생각')) {
      return responses.anxious[Math.floor(Math.random() * responses.anxious.length)];
    }
    if (text.includes('슬픔') || text.includes('우울') || text.includes('속상') || text.includes('아프')) {
      return responses.sad[Math.floor(Math.random() * responses.sad.length)];
    }
    return responses.general[Math.floor(Math.random() * responses.general.length)];
  };

  const handleFinishChat = () => {
    triggerHaptic(100);
    setScreen('step1');
  };

  // Action: Add / Delete / Toggle / Save planned todos
  const handleAddTodo = (text) => {
    if (!text.trim()) return;
    const item = { id: Date.now(), text: text.trim(), completed: false };
    setTodos([...todos, item]);
    setNewTodo('');
    triggerHaptic(50);
  };

  const handleDeleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
    triggerHaptic(50);
  };

  const handleToggleTodo = (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(updated);
    localStorage.setItem('sleep_rit_todos', JSON.stringify(updated));
    triggerHaptic(50);
  };

  const handleSaveTodosAndSleep = () => {
    setIsSavingTodos(true);
    triggerHaptic([100, 50, 100]);
    localStorage.setItem('sleep_rit_todos', JSON.stringify(todos));
    
    setTimeout(() => {
      setIsSavingTodos(false);
      setScreen('step1');
    }, 1500);
  };

  // Action: Blackout completes naturally
  const finishSleepRitual = () => {
    triggerHaptic([300, 100, 300]);
    // Save new statistics
    const newStreak = streak + 1;
    const newTotalMinutes = totalMinutes + sleepMusicDuration;
    
    setStreak(newStreak);
    setTotalMinutes(newTotalMinutes);
    localStorage.setItem('sleep_rit_streak', newStreak.toString());
    localStorage.setItem('sleep_rit_minutes', newTotalMinutes.toString());
    
    // Save placeholder or initial log with default quality 'good'
    const todayStr = new Date().toISOString().split('T')[0];
    const newLog = {
      date: todayStr,
      duration: sleepMusicDuration,
      quality: 'good'
    };

    let updatedLogs = sleepLogs.filter(l => l.date !== todayStr);
    updatedLogs.push(newLog);
    setSleepLogs(updatedLogs);
    localStorage.setItem('sleep_rit_logs', JSON.stringify(updatedLogs));

    setSleepSatisfaction('good'); // Default selected to 'good' (개운함) on morning screen
    setScreen('morning');
  };

  const handleCompleteMorning = () => {
    triggerHaptic(100);
    
    // Update log with final satisfaction rating
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedLogs = sleepLogs.map(l => {
      if (l.date === todayStr) {
        return { ...l, quality: sleepSatisfaction || 'good' };
      }
      return l;
    });
    setSleepLogs(updatedLogs);
    localStorage.setItem('sleep_rit_logs', JSON.stringify(updatedLogs));

    // Carry over incomplete todos or reset
    const incomplete = todos.filter(t => !t.completed);
    if (incomplete.length === 0) {
      setTodos([
        { id: 1, text: '이불 정리하기 🛌', completed: false },
        { id: 2, text: '따뜻한 물 한 잔 마시기 💧', completed: false }
      ]);
      localStorage.setItem('sleep_rit_todos', JSON.stringify([
        { id: 1, text: '이불 정리하기 🛌', completed: false },
        { id: 2, text: '따뜻한 물 한 잔 마시기 💧', completed: false }
      ]));
    } else {
      const resetIncomplete = incomplete.map(t => ({ ...t, completed: false }));
      setTodos(resetIncomplete);
      localStorage.setItem('sleep_rit_todos', JSON.stringify(resetIncomplete));
    }
    setScreen('dashboard');
  };

  const handleMixVolumeChange = (channel, val) => {
    const vol = parseFloat(val);
    setSoundMix(prev => {
      const updated = { ...prev, [channel]: vol };
      localStorage.setItem('sleep_rit_mix', JSON.stringify(updated));
      return updated;
    });
    if (audioSynth.current.isPlaying) {
      audioSynth.current.setChannelVolume(channel, vol);
    }
  };

  // Action: User interrupts sleep mode early
  const handleInterruptSleep = () => {
    audioSynth.current.stop();
    setScreen('dashboard');
  };

  // Volume slider controls on blackout screen
  const showVolumeSlider = (newVol) => {
    const boundedVol = Math.max(0, Math.min(1, newVol));
    setVolume(boundedVol);
    audioSynth.current.setVolume(boundedVol);
    setIsVolumeVisible(true);

    clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => {
      setIsVolumeVisible(false);
    }, 2000);
  };

  const handleBlackoutScroll = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    // Scroll up raises volume, scroll down lowers volume
    const volChange = delta < 0 ? 0.05 : -0.05;
    showVolumeSlider(volume + volChange);
  };

  const handleBlackoutTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleBlackoutTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    const diffY = touchStartY.current - currentY; // upward is positive
    const volChange = diffY > 0 ? 0.01 : -0.01;
    showVolumeSlider(volume + volChange);
  };

  const handleBlackoutTap = () => {
    // Show soft warning when they tap the black screen, to discourage checking phone
    setInteractionWarning(true);
    setTimeout(() => {
      setInteractionWarning(false);
    }, 3000);
  };

  // Format countdown remaining seconds
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  return (
    <div className="phone-frame">
      <div className="app-viewport">
        
        {/* DASHBOARD SCREEN */}
        {screen === 'dashboard' && (
          <div className="fade-enter-active">
            <div className="app-header">
              <h1>SleepRit</h1>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="streak-badge">
                  🔥 <span>{streak}일 연속</span>
                </div>
                <button 
                  type="button" 
                  className="settings-cog-btn" 
                  onClick={() => { setIsSettingsOpen(true); triggerHaptic(50); }}
                  aria-label="설정 및 기록"
                >
                  ⚙️
                </button>
              </div>
            </div>

            {/* Mode Toggle Switch (Lite vs Pro) */}
            <div className="mode-toggle-container">
              <button 
                type="button"
                className={`mode-toggle-btn ${isLiteMode ? 'active' : ''}`}
                onClick={() => { setIsLiteMode(true); triggerHaptic(40); }}
              >
                🍃 심플 모드 (무료)
              </button>
              <button 
                type="button"
                className={`mode-toggle-btn ${!isLiteMode ? 'active' : ''}`}
                onClick={() => { setIsLiteMode(false); triggerHaptic(40); }}
              >
                ✨ 프리미엄 모드 (프로)
              </button>
            </div>

            <div className="calming-greeting-card">
              <span className="candle-glow-icon">🕯️</span>
              <p className="calming-quote">
                오늘 밤, 스마트폰 도파민 중독을 끊고<br />
                나를 위한 아늑한 취침 의식을 시작하세요.
              </p>
            </div>

            {/* Sleep Reservation Timer Dial Card */}
            {(() => {
              // Calculate dial coordinates and offset based on active countdown
              let cx = 90;
              let cy = 15;
              let strokeDashoffset = 0;
              if (isReserveActive) {
                // Countdown starts as a complete circle (100%) and ticks down to 0%
                const pct = reserveTotalSeconds > 0 ? (reserveSecondsLeft / reserveTotalSeconds) : 0;
                const angle = pct * 2 * Math.PI;
                cx = 90 + 75 * Math.cos(angle);
                cy = 90 + 75 * Math.sin(angle);
                strokeDashoffset = 471.24 * (1 - pct);
              } else {
                // Idle state is always a complete circle (100% full) starting at 12 o'clock
                const pct = 1;
                const angle = pct * 2 * Math.PI;
                cx = 90 + 75 * Math.cos(angle);
                cy = 90 + 75 * Math.sin(angle);
                strokeDashoffset = 0;
              }

              return (
                <div className="glass-card timer-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h2 style={{ margin: 0 }}>수면 예약 타이머 ⏰</h2>
                      {isLiteMode && (
                        <span style={{ fontSize: '10px', background: 'rgba(255, 159, 67, 0.1)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '8px', border: '1px solid rgba(255, 159, 67, 0.2)', fontWeight: 'bold' }}>
                          무료
                        </span>
                      )}
                    </div>
                    <button 
                      type="button" 
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      onClick={() => { triggerHaptic(50); setShowAutomationGuide(true); }}
                    >
                      기기 차단 가이드 ❓
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'left', lineHeight: '1.4' }}>
                    {isReserveActive 
                      ? "예약 타이머가 작동 중입니다. 스마트폰을 계속 사용하더라도 시간 종료 시 수면 의식이 즉시 자동 시작됩니다."
                      : "지금으로부터 몇 시간/분 후에 잠자리에 들지 설정하세요. 타이머가 종료되면 수면 의식이 자동으로 활성화됩니다."
                    }
                  </p>

                  {/* Time Select Row for Hours and Minutes */}
                  <div className="time-select-row" style={{ opacity: isReserveActive ? 0.3 : 1, pointerEvents: isReserveActive ? 'none' : 'auto', marginBottom: '16px' }}>
                    <div className="time-select-group">
                      <label>시간</label>
                      <select 
                        value={Math.floor(timerDuration / 60)} 
                        onChange={(e) => {
                          const h = parseInt(e.target.value, 10);
                          const m = timerDuration % 60;
                          const newDuration = h * 60 + m;
                          setTimerDuration(newDuration === 0 ? 1 : newDuration);
                          triggerHaptic(50);
                        }}
                      >
                        {Array.from({ length: 13 }, (_, i) => (
                           <option key={i} value={i}>{i}시간</option>
                        ))}
                      </select>
                    </div>
                    <div className="time-select-group">
                      <label>분</label>
                      <select 
                        value={timerDuration % 60} 
                        onChange={(e) => {
                          const h = Math.floor(timerDuration / 60);
                          const m = parseInt(e.target.value, 10);
                          const newDuration = h * 60 + m;
                          setTimerDuration(newDuration === 0 ? 1 : newDuration);
                          triggerHaptic(50);
                        }}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <option key={i} value={i}>{i}분</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="radial-dial-container">
                    <div 
                      ref={dialRef}
                      className="dial-wrapper"
                      style={{ pointerEvents: 'none' }}
                    >
                      <svg className="dial-svg" viewBox="0 0 180 180">
                        <defs>
                          <linearGradient id="dial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent)" />
                            <stop offset="100%" stopColor="var(--accent-dim)" />
                          </linearGradient>
                        </defs>
                        
                        {/* Background Track */}
                        <circle className="dial-bg" cx="90" cy="90" r="75" />
                        
                        {/* Active Progress Arc */}
                        <circle 
                          className="dial-progress" 
                          cx="90" 
                          cy="90" 
                          r="75" 
                          strokeDasharray="471.24"
                          strokeDashoffset={strokeDashoffset}
                        />
                        
                        {/* Rotating Handle (Cat Emoji) */}
                        <text
                          x={cx}
                          y={cy + 2} // Slight baseline adjustment for vertical alignment
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{ 
                            fontSize: '18px', 
                            userSelect: 'none', 
                            cursor: 'default',
                            filter: 'drop-shadow(0 0 3px rgba(255, 159, 67, 0.4))'
                          }}
                        >
                          🐱
                        </text>
                      </svg>
                      
                      {/* Center time reading */}
                      <div className="dial-center-info">
                        {isReserveActive ? (
                          <>
                            <span className="unit" style={{ fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>남은 시간</span>
                            <span className="minutes" style={{ fontSize: '16px', fontWeight: '800', color: 'var(--accent)' }}>
                              {formatReserveTime(reserveSecondsLeft)}
                            </span>
                          </>
                        ) : (
                          <>
                            {Math.floor(timerDuration / 60) > 0 ? (
                              <>
                                <span className="hours" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)' }}>
                                  {Math.floor(timerDuration / 60)}시간
                                </span>
                                {timerDuration % 60 > 0 && (
                                  <span className="minutes" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>
                                    {timerDuration % 60}분
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="minutes">{timerDuration % 60}</span>
                                <span className="unit">분</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="presets-container" style={{ opacity: isReserveActive ? 0.3 : 1, pointerEvents: isReserveActive ? 'none' : 'auto' }}>
                      {[15, 30, 45, 60].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`preset-btn ${timerDuration === preset ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTimerDuration(preset);
                            triggerHaptic(50);
                          }}
                        >
                          {preset}분
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {isReserveActive ? (
              <button 
                type="button"
                className="btn-secondary" 
                style={{ marginTop: '8px', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                onClick={handleCancelReservation}
              >
                수면 예약 취소 ✕
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <button 
                  type="button"
                  className="btn-primary" 
                  style={{ marginTop: '8px' }}
                  onClick={() => handleStartReservation(timerDuration)}
                >
                  수면 예약 시작하기 ⏰
                </button>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-dim)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', marginTop: '12px' }}
                  onClick={() => handleStartReservation(0.1)} // 6 seconds test
                >
                  시뮬레이션 테스트 (6초 후 시작)
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: CHARGE & ISOLATE */}
        {screen === 'step1' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>
            
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                {isLiteMode ? "수면 준비" : "의식 2단계"}
              </div>
              <h2 style={{ fontSize: '24px', lineHeight: '1.3' }}>
                {isLiteMode ? "기기 격리 및 전원 연결" : "AI 수면 코치와 생각 비우기"}
              </h2>
              {!isLiteMode && (
                <h3 style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: '12px', fontWeight: '500' }}>기기 격리 및 전원 연결</h3>
              )}
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                스마트폰 충전기를 꽂고 침대에서 최소 2m 이상 떨어진 무드등 테이블 위에 놓아주세요.
              </p>
            </div>

            {/* Box 3 (Now 1st): AI Sleep Coach Chatbot */}
            <div 
              className="glass-card clickable-card" 
              style={{ 
                cursor: isLiteMode ? 'not-allowed' : 'pointer', 
                border: isLiteMode ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 159, 67, 0.15)', 
                margin: '12px 0 0 0', 
                padding: '16px 20px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                opacity: isLiteMode ? 0.5 : 1
              }}
              onClick={() => { 
                if (isLiteMode) {
                  triggerHaptic(100);
                  alert("💬 AI 수면 코칭은 프리미엄 전용 기능입니다. 대시보드 상단에서 프리미엄 모드로 전환해 보세요!");
                } else {
                  triggerHaptic(50); 
                  setScreen('coach-bot'); 
                }
              }}
            >
              <div style={{ fontSize: '28px' }}>{isLiteMode ? '🔒' : '💬'}</div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '14px', margin: 0, color: isLiteMode ? 'var(--text-muted)' : 'var(--accent)' }}>
                  AI 수면 코치와 생각 비우기 {isLiteMode && "✨"}
                </h3>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>
                  {isLiteMode 
                    ? "내 생각과 스트레스를 비우는 AI 수면 코칭 (프로 전용)" 
                    : "잠을 방해하는 잡념과 스트레스를 코치와 나누며 머릿속을 비우세요."
                  }
                </p>
              </div>
            </div>

            {/* Box 1 (Now 2nd): Charger connection checkbox */}
            <div className="glass-card" style={{ margin: '12px 0', padding: '16px 20px', textAlign: 'left' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                <input 
                  type="checkbox" 
                  checked={isChargerConnected}
                  onChange={(e) => setIsChargerConnected(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '15px', fontWeight: '600' }}>충전 케이블을 연결했습니다.</span>
              </label>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                기기가 전원에 연결되고 평평한 바닥에 엎어 놓였을 때(센서 인식 시) 다음 단계로 즉시 넘어갈 수 있습니다.
              </p>
            </div>

            {/* Box 2 (Now 3rd): Laptop/Desktop simulation card for Testing */}
            <div className="glass-card" style={{ margin: '0 0 12px 0', padding: '16px 20px', borderStyle: 'dashed', borderColor: 'var(--accent)' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '4px' }}>💻 데스크탑 시뮬레이터</h3>
              <p style={{ fontSize: '11px', marginBottom: '12px' }}>
                기기 센서를 모방하는 테스트용 가상 토글입니다.
              </p>
              <button 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  setIsChargerConnected(true);
                  handleNextFromStep1();
                }}
              >
                폰 엎어놓기 시뮬레이션 실행 (Flat Down)
              </button>
            </div>

            <button 
              className="btn-primary"
              disabled={!isChargerConnected}
              style={{ opacity: isChargerConnected ? 1 : 0.4, cursor: isChargerConnected ? 'pointer' : 'not-allowed', marginTop: '8px' }}
              onClick={handleNextFromStep1}
            >
              연결 완료
            </button>
          </div>
        )}

        {/* STEP 1.5: OFFLINE STRETCHING GUIDE */}
        {screen === 'stretching' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 3단계
              </div>
              <h2 style={{ fontSize: '24px' }}>취침 전 이완 스트레칭</h2>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                근육의 긴장을 풀고 신체를 편안한 수면 대기 상태로 유도합니다.
              </p>
            </div>

            {/* Stretch Card */}
            <div className="glass-card" style={{ padding: '24px', margin: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                {stretchIndex === 0 && "🧘"}
                {stretchIndex === 1 && "🙆‍♀️"}
                {stretchIndex === 2 && "🤸"}
              </div>
              <h3 style={{ fontSize: '18px', color: 'var(--accent)', marginBottom: '8px' }}>
                {stretchIndex === 0 && "1. 어깨와 가슴 열기"}
                {stretchIndex === 1 && "2. 목 라인 이완하기"}
                {stretchIndex === 2 && "3. 상체 옆선 늘리기"}
              </h3>
              <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
                {stretchIndex === 0 && "어깨를 뒤로 가볍게 돌려 가슴을 넓게 열고, 척추를 세운 채 기분 좋은 자극을 느끼며 호흡하세요."}
                {stretchIndex === 1 && "머리를 오른쪽으로 지긋이 늘려 좌측 목덜미와 승모근을 이완합니다. 반대쪽도 가볍게 풀어줍니다."}
                {stretchIndex === 2 && "깍지 낀 손을 하늘 높이 밀고 몸통을 좌우로 기울이며 굳어 있던 옆구리와 갈비뼈 주변을 풀어줍니다."}
              </p>
            </div>

            {/* Circular Timer UI */}
            <div className="stretching-timer-container">
              <div className="stretching-timer-circle">
                <span className="seconds">{stretchSecondsLeft}s</span>
                <span className="label">{isStretchActive ? "진행 중" : "일시 정지"}</span>
              </div>
            </div>

            {/* Dots indicator */}
            <div className="stretching-dot-indicator">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className={`stretch-dot ${idx === stretchIndex ? 'active' : ''}`} />
              ))}
            </div>

            {/* Action buttons */}
            <div className="stretching-controls">
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setIsStretchActive(!isStretchActive)}
              >
                {isStretchActive ? "일시정지" : "재개"}
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1.5 }}
                onClick={() => {
                  if (stretchIndex < 2) {
                    setStretchIndex(stretchIndex + 1);
                    setStretchSecondsLeft(stretchDuration);
                    setIsStretchActive(true);
                    triggerHaptic(50);
                  } else {
                    setScreen('step2');
                    triggerHaptic(100);
                  }
                }}
              >
                {stretchIndex < 2 ? "다음 동작" : "스트레칭 완료"}
              </button>
            </div>

            <button 
              type="button" 
              className="btn-secondary"
              style={{ marginTop: '12px', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
              onClick={handleSkipStretching}
            >
              스트레칭 건너뛰기
            </button>
          </div>
        )}

        {/* STEP 2: 4-7-8 BREATHING */}
        {screen === 'step2' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 4단계
              </div>
              <h2 style={{ fontSize: '24px' }}>4-7-8 이완 호흡</h2>
              <p style={{ marginTop: '8px' }}>심박수를 늦추고 자극된 부교감신경을 자극하여 뇌를 진정시키는 호흡법입니다.</p>
            </div>

            <div>
              {breathPhase === 'ready' ? (
                <div style={{ textAlign: 'center', margin: '40px 0' }}>
                  <button className="btn-secondary" style={{ width: 'auto', padding: '16px 32px' }} onClick={startBreathing}>
                    호흡 시작하기
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div className="breathing-circle-outer">
                    <div className={`breathing-circle ${breathPhase}`}>
                      {breathTimer}s
                    </div>
                  </div>
                  <div style={{ height: '50px' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '18px' }}>
                      {breathPhase === 'inhale' && '코로 숨을 깊게 들이쉬세요'}
                      {breathPhase === 'hold' && '호흡을 멈추세요'}
                      {breathPhase === 'exhale' && '입으로 천천히 내쉬세요'}
                      {breathPhase === 'done' && '호흡 완료'}
                    </h3>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>
                      {breathPhase !== 'done' && `총 ${breathCyclesMax}회 중 ${breathCycle}번째 사이클`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="btn-primary"
              onClick={handleNextFromStep2}
              style={{ marginTop: '20px' }}
            >
              {breathPhase === 'done' ? '호흡 완료 및 수면 모드 진입 🌙' : '건너뛰고 수면 모드 진입 🌙'}
            </button>
          </div>
        )}

        {/* STEP 2.5: AI SLEEP COACH CHATBOT */}
        {screen === 'coach-bot' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('step1')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 2.5단계
              </div>
              <h2 style={{ fontSize: '24px' }}>AI 수면 코치와 생각 비우기</h2>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                머릿속을 떠돌며 수면을 방해하는 오늘 하루의 잡념과 스트레스를 코치에게 털어놓아 마음의 무게를 줄여보세요.
              </p>
            </div>

            {/* Chat conversation area */}
            <div className="chat-container">
              <div className="chat-bubble-scroll" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-bubble ${msg.sender}`}>
                    {msg.text}
                  </div>
                ))}
                {isCoachTyping && (
                  <div className="chat-typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="todo-input-container" style={{ marginBottom: 0 }}>
                <input 
                  type="text"
                  className="todo-input"
                  placeholder="코치에게 고민이나 오늘 일을 적어보세요..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChatMessage(); }}
                  disabled={isCoachTyping}
                />
                <button 
                  type="button"
                  className="todo-add-btn"
                  onClick={handleSendChatMessage}
                  disabled={isCoachTyping}
                >
                  보내기
                </button>
              </div>
            </div>

            <button 
              type="button"
              className="btn-primary"
              onClick={handleFinishChat}
              disabled={isCoachTyping}
            >
              대화 완료 (의식 1단계로 돌아가기) 🕯️
            </button>
          </div>
        )}

        {/* STEP 3: TOMORROW'S TO-DO LIST */}
        {screen === 'step3' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 1단계
              </div>
              <h2 style={{ fontSize: '22px' }}>내일 아침 계획 (할 일 정리)</h2>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>
                잠들기 전 내일 할 일을 미리 적어두면 뇌가 안심하여 숙면할 수 있습니다.
              </p>
            </div>

            <div style={{ flexGrow: 1, margin: '20px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Input Container */}
              <div className="todo-input-container">
                <input 
                  type="text"
                  className="todo-input"
                  placeholder="내일 할 일을 적어보세요..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(newTodo); }}
                  disabled={isSavingTodos}
                />
                <button 
                  type="button"
                  className="todo-add-btn"
                  onClick={() => handleAddTodo(newTodo)}
                  disabled={isSavingTodos}
                >
                  추가
                </button>
              </div>

              {/* Recommendations */}
              <div style={{ textAlign: 'left', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>추천 루틴:</span>
                <div className="todo-recommendations" style={{ marginTop: '6px' }}>
                  {['따뜻한 물 한잔 💧', '이불 정리 🛌', '5분 스트레칭 🧘', '가벼운 아침 식사 🍎', '독서 10분 📖'].map((rec) => (
                    <span 
                      key={rec}
                      className="recommendation-chip"
                      onClick={() => handleAddTodo(rec)}
                    >
                      +{rec.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scrollable Todo List */}
              <div className="todo-list-scroll">
                {todos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '20px 0' }}>
                    내일 계획이 아직 비어있습니다.
                  </p>
                ) : (
                  todos.map((todo) => (
                    <div key={todo.id} className="todo-item">
                      <div className="todo-item-left">
                        <span className="todo-text">{todo.text}</span>
                      </div>
                      <button 
                        type="button"
                        className="todo-del-btn"
                        onClick={() => handleDeleteTodo(todo.id)}
                        disabled={isSavingTodos}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              className="btn-primary"
              onClick={handleSaveTodosAndSleep}
              disabled={isSavingTodos}
              style={{ marginTop: '10px' }}
            >
              {isSavingTodos ? '계획 저장 중...' : '계획 완료 및 기기 격리하기 📱'}
            </button>
          </div>
        )}

        {/* BLACKOUT SCREEN (SLEEP LOCKED) */}
        {screen === 'blackout' && (
          <div 
            className="blackout-screen"
            onWheel={handleBlackoutScroll}
            onTouchStart={handleBlackoutTouchStart}
            onTouchMove={handleBlackoutTouchMove}
            onClick={handleBlackoutTap}
          >
            {/* Tiny Exit cross in the corner - almost invisible, avoids tempting users */}
            <button 
              className="exit-ritual" 
              onClick={handleInterruptSleep}
              style={{ top: '15px', right: '15px', color: '#1e293b', fontSize: '16px' }}
            >
              ✕ 중단
            </button>

            {/* Countdown timer - very dim */}
            <div style={{ color: '#0f172a', fontSize: '12px', position: 'absolute', top: '24px', letterSpacing: '2px' }}>
              TIMER {formatTime(secondsRemaining)}
            </div>

            {/* Fading text guidance */}
            <div 
              className={`sleep-guidance-text ${isMessageVisible ? 'visible' : ''}`}
              style={{ color: '#475569', transition: 'opacity 1s ease-in-out' }}
            >
              {SLEEP_MESSAGES[currentMessageIdx]}
            </div>

            {/* Soft reminder warning if screen is tapped */}
            <div 
              className={`sleep-guidance-text ${interactionWarning ? 'visible' : ''}`}
              style={{ 
                position: 'absolute', 
                color: 'var(--accent-dim)', 
                fontSize: '12px', 
                fontWeight: '600', 
                bottom: '140px',
                transition: 'opacity 0.3s ease'
              }}
            >
              화면을 만지지 않고 눈을 감는 편이 좋습니다... 🕯️
            </div>

            {/* Temporary Volume overlay indicator */}
            <div className={`volume-indicator ${isVolumeVisible ? 'visible' : ''}`}>
              <span>소리 크기</span>
              <div className="volume-bar">
                <div 
                  className="volume-bar-fill" 
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
              <span>{Math.round(volume * 100)}%</span>
            </div>

            {/* Interaction guide */}
            <div style={{ position: 'absolute', bottom: '32px', color: '#1e293b', fontSize: '10px', pointerEvents: 'none' }}>
              쓸어올리거나 내리면 음량이 조절됩니다.
            </div>
          </div>
        )}

        {/* MORNING / RITUAL COMPLETE SCREEN (Display planned routine checkmarks) */}
        {screen === 'morning' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', textAlign: 'center' }}>
            
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>🌅</span>
              <h2 style={{ fontSize: '24px', color: 'var(--accent)' }}>좋은 아침입니다!</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                스마트폰 없이 개운한 아침을 맞이하셨나요?
              </p>
            </div>

            {/* Step 0.1: Sleep satisfaction check-in */}
            <div className="glass-card" style={{ padding: '16px', margin: '12px 0 0 0' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '4px', textAlign: 'left' }}>오늘 아침 컨디션은 어땠나요?</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'left' }}>
                기상 후 컨디션과 수면 만족도를 평가해 기록을 완성해 주세요.
              </p>
              <div className="sleep-feedback">
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'bad' ? 'selected' : ''}`}
                  onClick={() => { setSleepSatisfaction('bad'); triggerHaptic(50); }}
                  title="피곤함"
                >
                  😊
                </span>
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'meh' ? 'selected' : ''}`}
                  onClick={() => { setSleepSatisfaction('meh'); triggerHaptic(50); }}
                  title="보통"
                >
                  😐
                </span>
                <span 
                  className={`feedback-emoji ${sleepSatisfaction === 'good' ? 'selected' : ''}`}
                  onClick={() => { setSleepSatisfaction('good'); triggerHaptic(50); }}
                  title="개운함"
                >
                  😴
                </span>
              </div>
            </div>

            {/* Achievement Card */}
            <div className="glass-card" style={{ padding: '12px 16px', margin: '12px 0 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>연속 취침 성공 스트릭</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '2px' }}>
                  🔥 {streak}일 연속 달성
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>스마트폰 오프 디톡스</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent)', marginTop: '2px' }}>
                  +{sleepMusicDuration}분
                </div>
              </div>
            </div>

            {/* Planned routine todos */}
            <div className="glass-card" style={{ flexGrow: 1, margin: '12px 0', padding: '16px', display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '8px', borderBottom: '1px solid rgba(255,159,67,0.1)', paddingBottom: '4px' }}>오늘 아침의 약속 리스트</h3>
              <div className="todo-list-scroll" style={{ flexGrow: 1, maxHeight: '110px', marginBottom: '0' }}>
                {todos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                    계획된 루틴이 없습니다.
                  </p>
                ) : (
                  todos.map((todo) => (
                    <label key={todo.id} className="todo-item" style={{ cursor: 'pointer', padding: '8px 12px', marginBottom: '6px' }}>
                      <div className="todo-item-left">
                        <input 
                          type="checkbox"
                          className="todo-checkbox"
                          checked={todo.completed}
                          onChange={() => handleToggleTodo(todo.id)}
                        />
                        <span className={`todo-text ${todo.completed ? 'completed' : ''}`} style={{ fontSize: '13px' }}>
                          {todo.text}
                        </span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button 
              type="button"
              className="btn-primary"
              onClick={handleCompleteMorning}
            >
              기록 저장 및 완료 🌅
            </button>
          </div>
        )}

        {/* SETTINGS & ANALYTICS MODAL */}
        {isSettingsOpen && (
          <div className="settings-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
            <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <h2>수면 설정 및 기록</h2>
                <button 
                  type="button" 
                  className="settings-modal-close" 
                  onClick={() => setIsSettingsOpen(false)}
                >
                  ✕
                </button>
              </div>

              {/* Tab Selector inside settings modal */}
              <div className="dashboard-tabs" style={{ marginBottom: '16px' }}>
                <button 
                  type="button" 
                  className={`tab-btn ${settingsTab === 'sounds' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('sounds')}
                >
                  의식 설정 🎛️
                </button>
                <button 
                  type="button" 
                  className={`tab-btn ${settingsTab === 'analytics' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('analytics')}
                >
                  수면 분석 📊
                </button>
              </div>

              <div className="settings-modal-body">
                {settingsTab === 'sounds' ? (
                  <div className="glass-card modal-card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                    <div style={{ marginBottom: '16px', textAlign: 'left', position: 'relative' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block', fontWeight: '600', marginBottom: '12px' }}>
                        수면 환경음 사운드 믹서 🎛️
                      </span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: isLiteMode ? 0.35 : 1, pointerEvents: isLiteMode ? 'none' : 'auto' }}>
                        {[
                          { key: 'pad', label: '명상 비트 패드 🧘', desc: '델타파 바이노럴 비트 합성음' },
                          { key: 'rain', label: '차분한 빗소리 🌧️', desc: '노이즈 캔슬링 효과 백색소음' },
                          { key: 'fire', label: '따뜻한 모닥불 🔥', desc: '아늑한 나무 타는 소리 신스' },
                          { key: 'wind', label: '숲속의 바람 🍃', desc: '천연 횡격막 자극 바람음' }
                        ].map((item) => (
                          <div key={item.key} style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 'bold' }}>{item.label}</span>
                              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{Math.round(soundMix[item.key] * 100)}%</span>
                            </div>
                            <div className="slider-label" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                              {item.desc}
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.05"
                              value={soundMix[item.key]} 
                              onChange={(e) => handleMixVolumeChange(item.key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>

                      {isLiteMode && (
                        <div style={{
                          position: 'absolute',
                          top: 25,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(7, 9, 19, 0.45)',
                          backdropFilter: 'blur(3px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '16px',
                          border: '1px dashed rgba(255, 159, 67, 0.3)',
                          padding: '12px',
                          textAlign: 'center',
                          zIndex: 5
                        }}>
                          <div>
                            <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>🔒 ✨</span>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent)' }}>프리미엄 사운드 믹서</span>
                            <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                              음원들을 커스텀 조율하는 것은 프로 전용입니다.<br />무료 모드에서는 잔잔한 빗소리가 자동 재생됩니다.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="glass-card modal-card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block', fontWeight: '600', marginBottom: '12px', textAlign: 'left' }}>
                        의식 단계 상세 설정 ⚙️
                      </span>
                      
                      {/* Sleep Music Playback Duration */}
                      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '12px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold' }}>수면 음악 재생 시간 🎵</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{sleepMusicDuration}분 재생</span>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          블랙아웃 화면에서 수면 환경음이 자동으로 흘러나올 지속시간을 설정합니다.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[15, 30, 45, 60].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              className={`preset-btn ${sleepMusicDuration === mins ? 'active' : ''}`}
                              style={{ padding: '6px 0', fontSize: '12px' }}
                              onClick={() => {
                                setSleepMusicDuration(mins);
                                localStorage.setItem('sleep_rit_music_dur', mins.toString());
                                triggerHaptic(50);
                              }}
                            >
                              {mins}분
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Locked Pro Steps settings wrapper */}
                      <div style={{ position: 'relative', marginTop: '12px' }}>
                        <div style={{ opacity: isLiteMode ? 0.35 : 1, pointerEvents: isLiteMode ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Stretching Pose Duration */}
                          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 'bold' }}>3단계: 스트레칭 시간 🧘</span>
                              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>동작당 {stretchDuration}초</span>
                            </div>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              각 스트레칭 자세를 유지할 시간을 설정합니다.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[10, 15, 20, 30].map(sec => (
                                <button
                                  key={sec}
                                  type="button"
                                  className={`preset-btn ${stretchDuration === sec ? 'active' : ''}`}
                                  style={{ padding: '6px 0', fontSize: '12px' }}
                                  onClick={() => {
                                    setStretchDuration(sec);
                                    localStorage.setItem('sleep_rit_stretch_dur', sec.toString());
                                    triggerHaptic(50);
                                  }}
                                >
                                  {sec}초
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Breathing Cycles count */}
                          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 'bold' }}>4단계: 이완 호흡 사이클 🌬️</span>
                              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{breathCyclesMax}회 반복</span>
                            </div>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              4-7-8 이완 호흡을 반복할 횟수를 설정합니다.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[3, 4, 6, 8].map(cycles => (
                                <button
                                  key={cycles}
                                  type="button"
                                  className={`preset-btn ${breathCyclesMax === cycles ? 'active' : ''}`}
                                  style={{ padding: '6px 0', fontSize: '12px' }}
                                  onClick={() => {
                                    setBreathCyclesMax(cycles);
                                    localStorage.setItem('sleep_rit_breath_cycles', cycles.toString());
                                    triggerHaptic(50);
                                  }}
                                >
                                  {cycles}회
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {isLiteMode && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(7, 9, 19, 0.45)',
                            backdropFilter: 'blur(3px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '16px',
                            border: '1px dashed rgba(255, 159, 67, 0.3)',
                            padding: '12px',
                            textAlign: 'center',
                            zIndex: 5
                          }}>
                            <div>
                              <span style={{ fontSize: '20px', display: 'block', marginBottom: '4px' }}>🔒 ✨</span>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent)' }}>프리미엄 의식 단계 설정</span>
                              <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: '1.3' }}>
                                스트레칭 및 이완 호흡 설정은 프로 전용입니다.<br />무료 모드에서는 충전 연결 후 즉시 암전 모드로 넘어갑니다.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 수면 분석 탭 컨텐츠 */}
                    <div className="glass-card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none', textAlign: 'left' }}>
                      <div className="modal-stats-summary" style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <div className="modal-stat-item" style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>{totalMinutes}분</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>총 디톡스 시간</div>
                        </div>
                        <div className="modal-stat-item" style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>{streak}일</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>현재 스트릭</div>
                        </div>
                      </div>

                      <p style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>최근 28일 동안 스마트폰을 끄고 완수한 수면 의식 기록입니다.</p>
                      
                      <div className="heatmap-container">
                        <div className="heatmap-labels">
                          <span>28일 전</span>
                          <span>오늘</span>
                        </div>

                        {/* 4x7 Heatmap Grid */}
                        <div className="heatmap-grid">
                          {(() => {
                            const days = [];
                            const today = new Date();
                            for (let i = 27; i >= 0; i--) {
                              const d = new Date();
                              d.setDate(today.getDate() - i);
                              days.push(d.toISOString().split('T')[0]);
                            }
                            return days.map(dateStr => {
                              const log = sleepLogs.find(l => l.date === dateStr);
                              const isSelected = selectedLogDetail && selectedLogDetail.date === dateStr;
                              const cellColor = log ? (
                                log.duration <= 15 ? 'rgba(255, 159, 67, 0.25)' :
                                log.duration <= 30 ? 'rgba(255, 159, 67, 0.55)' :
                                log.duration <= 60 ? 'rgba(255, 159, 67, 0.75)' :
                                'rgba(255, 159, 67, 0.95)'
                              ) : 'rgba(255, 255, 255, 0.03)';

                              return (
                                <div 
                                  key={dateStr}
                                  className={`heatmap-cell ${isSelected ? 'selected' : ''}`}
                                  style={{ backgroundColor: cellColor }}
                                  onClick={() => {
                                    triggerHaptic(30);
                                    if (log) {
                                      setSelectedLogDetail(log);
                                    } else {
                                      setSelectedLogDetail({ date: dateStr, duration: 0, quality: 'none' });
                                    }
                                  }}
                                  title={dateStr}
                                />
                              );
                            });
                          })()}
                        </div>

                        {/* Heatmap Legend */}
                        <div className="heatmap-legend">
                          <span>미달성</span>
                          <div className="legend-box" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,159,67,0.05)' }} />
                          <div className="legend-box" style={{ backgroundColor: 'rgba(255, 159, 67, 0.25)' }} />
                          <div className="legend-box" style={{ backgroundColor: 'rgba(255, 159, 67, 0.55)' }} />
                          <div className="legend-box" style={{ backgroundColor: 'rgba(255, 159, 67, 0.75)' }} />
                          <div className="legend-box" style={{ backgroundColor: 'rgba(255, 159, 67, 0.95)' }} />
                          <span>1시간+</span>
                        </div>
                      </div>

                      {/* Selected cell details */}
                      {selectedLogDetail ? (
                        <div className="log-detail-box">
                          <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: '4px' }}>
                            {selectedLogDetail.date} 기록
                          </div>
                          {selectedLogDetail.duration > 0 ? (
                            <div>
                              • 수면 음악 재생 시간: <strong>{selectedLogDetail.duration}분</strong><br />
                              • 아침 컨디션 상태: <strong>
                                {selectedLogDetail.quality === 'good' && '좋음 (개운함) 😴'}
                                {selectedLogDetail.quality === 'meh' && '보통 😐'}
                                {selectedLogDetail.quality === 'bad' && '피곤함 😊'}
                              </strong>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)' }}>스마트폰 디톡스 의식을 진행하지 않은 날입니다.</div>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: '11px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '8px' }}>
                          원형 타일을 클릭하면 일별 상세 수면 기록을 확인할 수 있습니다.
                        </p>
                      )}
                    </div>

                    <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '13px', margin: 0 }}>데이터 관리</h4>
                        <p style={{ fontSize: '10px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>로컬 데이터 초기화</p>
                      </div>
                      <button 
                        type="button"
                        className="btn-secondary"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                        onClick={() => {
                          if (window.confirm("그동안의 수면 기록을 모두 삭제하고 초기화하시겠습니까?")) {
                            localStorage.removeItem('sleep_rit_logs');
                            localStorage.removeItem('sleep_rit_streak');
                            localStorage.removeItem('sleep_rit_minutes');
                            setStreak(0);
                            setTotalMinutes(0);
                            setSleepLogs([]);
                            setSelectedLogDetail(null);
                            triggerHaptic([100, 50, 100]);
                          }
                        }}
                      >
                        데이터 초기화
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AUTOMATION GUIDE MODAL */}
        {showAutomationGuide && (
          <div className="settings-modal-overlay" onClick={() => setShowAutomationGuide(false)}>
            <div className="settings-modal-content" style={{ maxHeight: '85%', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <h2>기기 자동화 & 앱 차단 가이드</h2>
                <button 
                  type="button" 
                  className="settings-modal-close" 
                  onClick={() => setShowAutomationGuide(false)}
                >
                  ✕
                </button>
              </div>
              <div className="settings-modal-body" style={{ overflowY: 'auto', textAlign: 'left', fontSize: '13px', lineHeight: '1.6' }}>
                <div style={{ background: 'rgba(255, 159, 67, 0.08)', border: '1px solid rgba(255,159,67,0.2)', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
                  <strong>⚠️ 모바일 브라우저의 한계 및 대안 안내</strong>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                    iOS 및 Android OS의 보안 규정상, 브라우저 웹앱이 인스타그램이나 유튜브 같은 타사 네이티브 앱을 강제 종료(Kill)하거나 백그라운드 상태에서 스스로를 화면 전면으로 활성화시키는 것은 불가합니다.<br />
                    대신 아래의 <strong>단축어/모드 및 루틴</strong> 기능을 이용하면 원하시는 시점에 타사 앱 차단 및 슬립릿 실행을 자동화할 수 있습니다!
                  </p>
                </div>

                <h3 style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: '4px', fontWeight: 'bold' }}>🤖 안드로이드 (갤럭시 모드 및 루틴)</h3>
                <ol style={{ paddingLeft: '20px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-main)' }}>
                  <li>스마트폰 설정 앱 &gt; <strong>모드 및 루틴</strong>에 진입합니다.</li>
                  <li>루틴 탭에서 새 루틴을 추가하고, <strong>'언제 실행할까요?'</strong> 조건으로 <strong>'시간'</strong> 또는 <strong>'특정 시간 동안'</strong>을 설정합니다.</li>
                  <li><strong>'무엇을 할까요?'</strong> 동작으로 다음 항목들을 설정합니다:
                    <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                      <li><strong>앱 열기</strong>: 크롬 또는 브라우저 선택 후 SleepRit 웹 페이지 연결</li>
                      <li><strong>앱 제한</strong>: 유튜브, 카카오톡, 인스타 등을 차단 목록으로 등록</li>
                    </ul>
                  </li>
                </ol>

                <h3 style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: '4px', fontWeight: 'bold' }}>🍎 아이폰 (iOS 단축어)</h3>
                <ol style={{ paddingLeft: '20px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-main)' }}>
                  <li><strong>'단축어(Shortcuts)'</strong> 앱 &gt; 하단 <strong>'개인화 자동화'</strong>로 이동합니다.</li>
                  <li>새로운 자동화를 추가하고 <strong>'특정 시간'</strong> 또는 <strong>'취침 시간 예약'</strong>을 조건으로 선택합니다.</li>
                  <li>자동화 실행 동작으로 다음 동작들을 구성합니다:
                    <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                      <li><strong>'URL 열기'</strong>: 슬립릿 접속 주소를 입력합니다.</li>
                      <li><strong>'앱 사용 시간 제한'</strong>(스크린 타임) 설정을 이용해 타사 SNS/유튜브 제한을 활성화합니다.</li>
                    </ul>
                  </li>
                </ol>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
                  💡 슬립릿 예약 타이머는 브라우저가 켜져 있거나 푸시 알림 수신 상태일 때 햅틱 경고와 사운드를 울려, 스마트폰을 내려놓고 의식(To-Do 작성 및 기기 연결)을 완료하도록 강력히 독려합니다.
                </p>
                
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ marginTop: '16px' }}
                  onClick={() => setShowAutomationGuide(false)}
                >
                  확인했습니다
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RESERVATION START MODAL */}
        {showReservationStartModal && (
          <div className="settings-modal-overlay" onClick={() => setShowReservationStartModal(false)}>
            <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <h2>수면 예약 타이머 작동 시작 ⏰</h2>
                <button 
                  type="button" 
                  className="settings-modal-close" 
                  onClick={() => setShowReservationStartModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="settings-modal-body" style={{ textAlign: 'left', fontSize: '13px', lineHeight: '1.6' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>⏰</span>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent)' }}>
                    {Math.floor(timerDuration / 60) > 0 ? `${Math.floor(timerDuration / 60)}시간 ` : ''}
                    {timerDuration % 60 > 0 ? `${timerDuration % 60}분 ` : ''}
                    후 예약 실행
                  </div>
                </div>

                <p style={{ marginBottom: '12px' }}>
                  <strong>수면 예약 타이머가 정상 동작 중입니다!</strong> 이제 아래 단계에 따라 안심하고 다른 업무나 즐길 거리를 하셔도 좋습니다.
                </p>

                <ul style={{ paddingLeft: '20px', marginBottom: '16px', listStyleType: 'decimal' }}>
                  <li style={{ marginBottom: '8px' }}>
                    <strong>앱 최소화</strong>: 지금 홈 버튼을 누르거나 화면을 쓸어 올려 SleepRit 브라우저 탭을 백그라운드로 전환하고 유튜브나 다른 소셜 앱을 사용하세요.
                  </li>
                  <li style={{ marginBottom: '8px' }}>
                    <strong>백그라운드 알림 대기</strong>: 약속한 시간이 되면 <strong>웹 푸시 알림</strong>과 함께 우렁찬 <strong>경고 오디오 사운드, 햅틱 진동</strong>이 발생합니다.
                  </li>
                  <li>
                    <strong>슬립릿 복귀</strong>: 알림을 누르거나 슬립릿 브라우저 창으로 복귀하는 즉시, 화면이 강제 고정되어 수면 전 디톡스 의식(할 일 리스트 정리, 충전 연결 등) 단계가 실행됩니다.
                  </li>
                </ul>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => setShowReservationStartModal(false)}
                  >
                    이해했습니다 (홈으로 나가기)
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ border: '1px dashed var(--accent)', color: 'var(--accent)' }}
                    onClick={() => {
                      setShowReservationStartModal(false);
                      setShowAutomationGuide(true);
                      triggerHaptic(50);
                    }}
                  >
                    기기 차단 자동화 가이드 보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
