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
  const [timerDuration, setTimerDuration] = useState(15); // minutes (1 to 120)
  const [streak, setStreak] = useState(5);
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [sleepSatisfaction, setSleepSatisfaction] = useState(null);
  
  // Dashboard Tabs & Logs
  const [dashboardTab, setDashboardTab] = useState('settings'); // 'settings' | 'analytics'
  const [sleepLogs, setSleepLogs] = useState([]);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  
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
    
    // Map angle to 1 - 120 minutes
    const pct = angle / (2 * Math.PI);
    const minutes = Math.round(pct * 119) + 1;
    setTimerDuration(Math.max(1, Math.min(120, minutes)));
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

  // Read initial stats from localStorage
  useEffect(() => {
    const storedStreak = localStorage.getItem('sleep_rit_streak');
    const storedMinutes = localStorage.getItem('sleep_rit_minutes');
    const storedTodos = localStorage.getItem('sleep_rit_todos');
    const storedLogs = localStorage.getItem('sleep_rit_logs');
    const storedMix = localStorage.getItem('sleep_rit_mix');
    
    if (storedStreak) setStreak(parseInt(storedStreak, 10));
    if (storedMinutes) setTotalMinutes(parseInt(storedMinutes, 10));
    
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
      if (breathCycle >= 3) {
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
        audioSynth.current.setChannelVolume(channel, soundMix[channel]);
      });

      // Start countdown
      setSecondsRemaining(timerDuration * 60);

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
    setScreen('stretching');
    setStretchIndex(0);
    setStretchSecondsLeft(15);
    setIsStretchActive(true);
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
  }, [screen, isStretchActive, stretchSecondsLeft, stretchIndex]);

  const handleStretchTimerComplete = () => {
    triggerHaptic(120);
    if (stretchIndex < 2) {
      setStretchIndex(prev => prev + 1);
      setStretchSecondsLeft(15);
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
    setScreen('coach-bot');
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
    setScreen('step3');
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
      setScreen('blackout');
    }, 1500);
  };

  // Action: Blackout completes naturally
  const finishSleepRitual = () => {
    triggerHaptic([300, 100, 300]);
    // Save new statistics
    const newStreak = streak + 1;
    const newTotalMinutes = totalMinutes + timerDuration;
    
    setStreak(newStreak);
    setTotalMinutes(newTotalMinutes);
    localStorage.setItem('sleep_rit_streak', newStreak.toString());
    localStorage.setItem('sleep_rit_minutes', newTotalMinutes.toString());
    
    // Log current session
    const todayStr = new Date().toISOString().split('T')[0];
    const newLog = {
      date: todayStr,
      duration: timerDuration,
      quality: sleepSatisfaction || 'good'
    };

    let updatedLogs = sleepLogs.filter(l => l.date !== todayStr);
    updatedLogs.push(newLog);
    setSleepLogs(updatedLogs);
    localStorage.setItem('sleep_rit_logs', JSON.stringify(updatedLogs));

    setScreen('morning');
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
              <div className="streak-badge">
                🔥 <span>{streak}일 연속</span>
              </div>
            </div>

            <p style={{ marginBottom: '24px', textAlign: 'left' }}>
              오늘 밤, 스마트폰 도파민 중독을 끊고 나를 위한 아늑한 취침 의식을 시작하세요.
            </p>

            <div className="dashboard-stats">
              <div className="stat-item">
                <div className="stat-val">{totalMinutes}분</div>
                <div className="stat-label">총 디톡스 시간</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">어젯밤 수면</div>
                <div className="stat-label">
                  {sleepSatisfaction === 'good' && '좋음 😴'}
                  {sleepSatisfaction === 'meh' && '보통 😐'}
                  {sleepSatisfaction === 'bad' && '피곤 😊'}
                  {!sleepSatisfaction && '기록 없음'}
                </div>
              </div>
            </div>

            {/* Dashboard Navigation Tabs */}
            <div className="dashboard-tabs">
              <button 
                type="button" 
                className={`tab-btn ${dashboardTab === 'settings' ? 'active' : ''}`}
                onClick={() => setDashboardTab('settings')}
              >
                수면 설정
              </button>
              <button 
                type="button" 
                className={`tab-btn ${dashboardTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setDashboardTab('analytics')}
              >
                수면 기록 (통계)
              </button>
            </div>

            {dashboardTab === 'settings' ? (
              <>
                {/* Step 0.1: Sleep satisfaction check-in */}
                <div className="glass-card">
                  <h2>오늘 아침 컨디션은 어땠나요?</h2>
                  <p style={{ marginBottom: '12px' }}>매일 아침 수면 평가를 기록해 습관을 교정하세요.</p>
                  <div className="sleep-feedback">
                    <span 
                      className={`feedback-emoji ${sleepSatisfaction === 'bad' ? 'selected' : ''}`}
                      onClick={() => setSleepSatisfaction('bad')}
                      title="피곤함"
                    >
                      😊
                    </span>
                    <span 
                      className={`feedback-emoji ${sleepSatisfaction === 'meh' ? 'selected' : ''}`}
                      onClick={() => setSleepSatisfaction('meh')}
                      title="보통"
                    >
                      😐
                    </span>
                    <span 
                      className={`feedback-emoji ${sleepSatisfaction === 'good' ? 'selected' : ''}`}
                      onClick={() => setSleepSatisfaction('good')}
                      title="개운함"
                    >
                      😴
                    </span>
                  </div>
                </div>

                {/* Set Audio & Timer settings */}
                <div className="glass-card">
                  <h2>수면 의식 설정</h2>
                  
                  <div className="radial-dial-container">
                    <div 
                      ref={dialRef}
                      className="dial-wrapper"
                      onMouseDown={handleDialMouseDown}
                      onTouchStart={handleDialTouchStart}
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
                          strokeDashoffset={471.24 * (1 - (timerDuration - 1) / 119)}
                        />
                        
                        {/* Rotating Handle */}
                        <circle 
                          className="dial-handle" 
                          cx={90 + 75 * Math.cos(((timerDuration - 1) / 119) * 2 * Math.PI - Math.PI / 2)} 
                          cy={90 + 75 * Math.sin(((timerDuration - 1) / 119) * 2 * Math.PI - Math.PI / 2)} 
                          r="10" 
                        />
                      </svg>
                      
                      {/* Center time reading */}
                      <div className="dial-center-info">
                        <span className="minutes">{timerDuration}</span>
                        <span className="unit">분</span>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="presets-container">
                      {[15, 30, 60, 90].map((preset) => (
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

                  <div style={{ marginTop: '20px', textAlign: 'left' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block', fontWeight: '600', marginBottom: '12px' }}>
                      수면 환경음 사운드 믹서 🎛️
                    </span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  </div>
                </div>

                <button 
                  className="btn-primary" 
                  style={{ marginTop: '16px' }}
                  onClick={() => setScreen('step1')}
                >
                  수면 의식 시작하기 🌙
                </button>
              </>
            ) : (
              <>
                {/* 수면 분석 탭 컨텐츠 */}
                <div className="glass-card" style={{ padding: '20px', textAlign: 'left' }}>
                  <h2>수면 리추얼 통계</h2>
                  <p style={{ marginBottom: '16px' }}>최근 28일 동안 스마트폰을 끄고 완수한 수면 의식 기록입니다.</p>
                  
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

                <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', margin: 0 }}>데이터 관리</h3>
                    <p style={{ fontSize: '11px', margin: '2px 0 0 0' }}>로컬 데이터 초기화하기</p>
                  </div>
                  <button 
                    type="button"
                    className="btn-secondary"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
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
        )}

        {/* STEP 1: CHARGE & ISOLATE */}
        {screen === 'step1' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>
            
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 1단계
              </div>
              <h2 style={{ fontSize: '24px', lineHeight: '1.3' }}>기기 격리 및 전원 연결</h2>
              <p style={{ marginTop: '16px', fontSize: '15px' }}>
                스마트폰 충전기를 꽂고 침대에서 최소 2m 이상 떨어진 무드등 테이블 위에 놓아주세요.
              </p>
            </div>

            <div className="glass-card" style={{ margin: '40px 0', padding: '24px', textAlign: 'left' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
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

            {/* Laptop/Desktop simulation card for Testing */}
            <div className="glass-card" style={{ borderStyle: 'dashed', borderColor: 'var(--accent)' }}>
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
              style={{ opacity: isChargerConnected ? 1 : 0.4, cursor: isChargerConnected ? 'pointer' : 'not-allowed' }}
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
                의식 1.5단계
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
                    setStretchSecondsLeft(15);
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
                의식 2단계
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
                      {breathPhase !== 'done' && `총 3회 중 ${breathCycle}번째 사이클`}
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
              {breathPhase === 'done' ? '호흡 완료 (다음 단계)' : '건너뛰고 다음 단계'}
            </button>
          </div>
        )}

        {/* STEP 2.5: AI SLEEP COACH CHATBOT */}
        {screen === 'coach-bot' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

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
              대화 마치고 내일 계획하기
            </button>
          </div>
        )}

        {/* STEP 3: TOMORROW'S TO-DO LIST */}
        {screen === 'step3' && (
          <div className="fade-enter-active" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <button className="exit-ritual" onClick={() => setScreen('dashboard')}>✕</button>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                의식 3단계
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
              {isSavingTodos ? '계획 저장 중...' : '일과 계획 완료 및 취침 🌙'}
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
            
            <div style={{ marginTop: '30px' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🌅</span>
              <h2 style={{ fontSize: '24px', color: 'var(--accent)' }}>좋은 아침입니다!</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                어젯밤 잠들기 전 계획한 아침 루틴을 확인하세요.
              </p>
            </div>

            {/* Planned routine todos */}
            <div className="glass-card" style={{ flexGrow: 1, margin: '16px 0', padding: '16px', display: 'flex', flexDirection: 'column', textAlign: 'left', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '10px', borderBottom: '1px solid rgba(255,159,67,0.1)', paddingBottom: '6px' }}>오늘 아침의 약속 리스트</h3>
              <div className="todo-list-scroll" style={{ flexGrow: 1, maxHeight: '180px' }}>
                {todos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                    계획된 루틴이 없습니다.
                  </p>
                ) : (
                  todos.map((todo) => (
                    <label key={todo.id} className="todo-item" style={{ cursor: 'pointer' }}>
                      <div className="todo-item-left">
                        <input 
                          type="checkbox"
                          className="todo-checkbox"
                          checked={todo.completed}
                          onChange={() => handleToggleTodo(todo.id)}
                        />
                        <span className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                          {todo.text}
                        </span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Achievement Card */}
            <div className="glass-card" style={{ padding: '12px 20px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>연속 취침 성공 스트릭</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '2px' }}>
                  🔥 {streak}일 연속 달성
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>스마트폰 오프 타임</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)', marginTop: '2px' }}>
                  +{timerDuration}분
                </div>
              </div>
            </div>

            <button 
              className="btn-primary"
              onClick={() => {
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
                  // Reset completed status of incomplete ones to carry over
                  const resetIncomplete = incomplete.map(t => ({ ...t, completed: false }));
                  setTodos(resetIncomplete);
                  localStorage.setItem('sleep_rit_todos', JSON.stringify(resetIncomplete));
                }
                setScreen('dashboard');
              }}
            >
              의식 종료 및 대시보드
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
