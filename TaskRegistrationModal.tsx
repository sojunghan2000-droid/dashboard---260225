// --- Task Registration Modal Component ---

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { 
  Task, 
  Organization, 
  CategoryMaster, 
  UserContextType,
  NewTaskFormData 
} from './types';
import { categoryMasterData, categoryCodeMapping, orgCodeMapping } from './data';
import { calculateWorkingDays, getTodayStr } from './utils';

interface TaskRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Task) => void;
  organization: Organization;
  existingTasks: Task[];
  currentUser: UserContextType;
  onNotification: (message: string, type: 'success' | 'error') => void;
}

// 멤버 정보 조회 헬퍼
const getMemberInfo = (memberId: string, organization: Organization) => {
  for (const dept of organization.departments) {
    for (const team of dept.teams) {
      for (const group of team.groups) {
        const member = group.members.find(m => m.id === memberId);
        if (member) {
          return { 
            ...member, 
            group: group.name, 
            team: team.name, 
            department: dept.name, 
            teamId: team.id 
          };
        }
      }
    }
  }
  return null;
};

// Task Code 생성 헬퍼
const generateTaskCode = (
  formData: NewTaskFormData,
  memberInfo: any,
  teamCategoryMaster: CategoryMaster,
  existingTasks: Task[]
): string => {
  if (!memberInfo || !formData.category1 || !formData.category2 || !formData.category3) {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `T-${dateStr}-${Math.floor(Math.random() * 1000)}`;
  }

  try {
    // 조직 코드 매핑
    const deptCode = (orgCodeMapping.departments as any)[memberInfo.department] || 'DXX';
    const teamCode = (orgCodeMapping.teams as any)[memberInfo.team] || 'TXX';
    const groupCode = (orgCodeMapping.groups as any)[memberInfo.group] || 'GXX';
    const orgPrefix = `${deptCode}-${teamCode}-${groupCode}`;

    // 카테고리 코드 매핑
    const cat1Code = (categoryCodeMapping.category1 as any)[formData.category1] || 'X01';
    
    // 카테고리 인덱스 찾기
    const cat1Data = teamCategoryMaster[formData.category1] || {};
    const cat2Keys = Object.keys(cat1Data);
    const cat2Index = cat2Keys.indexOf(formData.category2) + 1 || 1;
    
    const cat3Keys = cat1Data[formData.category2] || [];
    const cat3Index = cat3Keys.indexOf(formData.category3) + 1 || 1;

    // 일련번호 계산
    const prefixPattern = `${orgPrefix}-${cat1Code}.${cat2Index}.${cat3Index}`;
    const existingCount = existingTasks.filter(
      t => t.taskCode && t.taskCode.startsWith(prefixPattern)
    ).length;
    const nextSequence = existingCount + 1;

    return `${prefixPattern}.${nextSequence}`;
  } catch (err) {
    console.error("Task Code Generation Error:", err);
    return `ERR-${Date.now()}`;
  }
};

// 자동 Task 이름 생성
const generateAutoTaskName = (
  category1: string,
  category2: string,
  category3: string,
  existingTasks: Task[]
): string => {
  if (!category1 || !category2 || !category3) return '';
  
  const baseName = `${category1}_${category2}_${category3}`;
  const matchingTasks = existingTasks.filter(t => t.name.startsWith(baseName));
  
  if (matchingTasks.length === 0) return baseName;
  
  let maxNum = 0;
  matchingTasks.forEach(t => {
    if (t.name === baseName) {
      if (maxNum === 0) maxNum = 1;
    } else {
      const match = t.name.match(/#(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  
  return `${baseName} #${maxNum + 1}`;
};

export const TaskRegistrationModal: React.FC<TaskRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  organization,
  existingTasks,
  currentUser,
  onNotification
}) => {
  // 초기 폼 데이터 생성 함수
  const getInitialFormData = useCallback((): NewTaskFormData => {
    const defaultAssignee = (currentUser && currentUser.role === 'member') 
      ? currentUser.id 
      : 'emp01';
    
    return {
      category1: '',
      category2: '',
      category3: '',
      name: '',
      assignee: defaultAssignee,
      plannedStart: getTodayStr(),
      plannedEnd: getTodayStr(),
      plannedDailyHours: '8',
      plannedHours: '8'
    };
  }, [currentUser]);

  const [formData, setFormData] = useState<NewTaskFormData>(getInitialFormData());

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData());
    }
  }, [isOpen, getInitialFormData]);

  // 선택된 담당자의 팀 카테고리 마스터
  const selectedTeamCategoryMaster = useMemo(() => {
    const memberInfo = getMemberInfo(formData.assignee, organization);
    if (!memberInfo) return {};
    
    const team = organization.departments[0]?.teams.find(t => t.id === memberInfo.teamId);
    return team ? team.categoryMaster : {};
  }, [formData.assignee, organization]);

  // OBS 권한 필터링: Lv.2 키 추출
  const authorizedLv2Keys = useMemo(() => {
    const memberInfo = getMemberInfo(formData.assignee, organization);
    if (!memberInfo) return new Set<string>();
    
    const keys = new Set<string>();
    Object.values(selectedTeamCategoryMaster).forEach((teamMap: any) => {
      const works = teamMap[memberInfo.team];
      if (Array.isArray(works)) {
        works.forEach((w: string) => keys.add(w));
      }
    });
    return keys;
  }, [formData.assignee, organization, selectedTeamCategoryMaster]);

  // Lv.1 옵션 (OBS 항목 제외)
  const category1Options = useMemo(() => {
    return Object.keys(categoryMasterData).filter(key => !/^\d+\.\s/.test(key));
  }, []);

  // Lv.2 옵션 (OBS 권한 필터링)
  const category2Options = useMemo(() => {
    if (!formData.category1) return [];
    
    const allLv2Keys = Object.keys(categoryMasterData[formData.category1] || {});
    
    if (authorizedLv2Keys.size > 0) {
      return allLv2Keys.filter(key => authorizedLv2Keys.has(key));
    }
    
    return [];
  }, [formData.category1, authorizedLv2Keys]);

  // Lv.3 옵션
  const category3Options = useMemo(() => {
    if (!formData.category1 || !formData.category2) return [];
    return categoryMasterData[formData.category1]?.[formData.category2] || [];
  }, [formData.category1, formData.category2]);

  // 폼 필드 변경 핸들러
  const handleFieldChange = useCallback((field: keyof NewTaskFormData, value: string) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };

      // 카테고리 변경 시 자동 이름 생성
      if (['category1', 'category2', 'category3'].includes(field)) {
        if (updated.category1 && updated.category2 && updated.category3) {
          updated.name = generateAutoTaskName(
            updated.category1,
            updated.category2,
            updated.category3,
            existingTasks
          );
        }
      }

      // 하위 카테고리 초기화
      if (field === 'category1') {
        updated.category2 = '';
        updated.category3 = '';
      } else if (field === 'category2') {
        updated.category3 = '';
      }

      // 날짜 유효성 검사
      if (field === 'plannedStart' && updated.plannedEnd && updated.plannedEnd < value) {
        updated.plannedEnd = value;
      }
      
      if (field === 'plannedEnd' && updated.plannedStart && value < updated.plannedStart) {
        alert("종료일은 시작일보다 빠를 수 없습니다.");
        updated.plannedEnd = updated.plannedStart;
      }

      // 계획 시수 자동 계산
      if (
        (field === 'plannedStart' || field === 'plannedEnd' || field === 'plannedDailyHours') &&
        updated.plannedStart &&
        updated.plannedEnd &&
        updated.plannedDailyHours
      ) {
        const days = calculateWorkingDays(updated.plannedStart, updated.plannedEnd);
        updated.plannedHours = String(days * Number(updated.plannedDailyHours));
      }

      return updated;
    });
  }, [existingTasks]);

  // 제출 핸들러
  const handleSubmit = useCallback(() => {
    // 유효성 검사
    if (!formData.name.trim()) {
      alert('Task명은 필수 입력 항목입니다.');
      return;
    }

    // 카테고리 선택 여부 확인
    if (!formData.category1 || !formData.category2 || !formData.category3) {
      if (!confirm('카테고리가 선택되지 않았습니다. 임시 코드로 생성하시겠습니까?')) {
        return;
      }
    }

    // 담당자 정보 조회
    const memberInfo = getMemberInfo(formData.assignee, organization);
    if (!memberInfo) {
      alert('담당자 정보를 찾을 수 없습니다.');
      return;
    }

    // Task Code 생성
    const taskCode = generateTaskCode(
      formData,
      memberInfo,
      selectedTeamCategoryMaster,
      existingTasks
    );

    // Task 객체 생성
    const newTask: Task = {
      id: `TASK-${Date.now()}`,
      taskCode,
      name: formData.name,
      category1: formData.category1 || '',
      category2: formData.category2 || '',
      category3: formData.category3 || '',
      department: memberInfo.department || '미지정',
      team: memberInfo.team,
      group: memberInfo.group,
      assignee: formData.assignee,
      assigneeName: memberInfo.name,
      planned: {
        startDate: formData.plannedStart || null,
        endDate: formData.plannedEnd || null,
        hours: Number(formData.plannedHours) || 0
      },
      actual: { startDate: null, endDate: null, hours: 0 },
      revisions: [],
      status: 'not-started',
      monthlyIssues: [{
        date: getTodayStr(),
        issue: "신규 Task 등록 (수동)",
        reviewed: false,
        replies: []
      }],
      isActive: true
    };

    onSubmit(newTask);
    onNotification(`Task 등록 완료 (Code: ${taskCode})`, 'success');
    onClose();
  }, [formData, organization, selectedTeamCategoryMaster, existingTasks, onSubmit, onNotification, onClose]);

  if (!isOpen) return null;

  // 스타일 정의
  const inputStyle = { backgroundColor: 'white', color: '#333', borderColor: '#ced4da' };
  const disabledStyle = { backgroundColor: '#e9ecef', color: '#6c757d', borderColor: '#ced4da' };

  // 멤버 정보 (옵션 렌더링용)
  const memberInfo = getMemberInfo(formData.assignee, organization);
  const assigneeTeamName = memberInfo ? memberInfo.team : '';

  return (
    <div 
      className="modal show" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content">
        <h3 className="modal-header">Task 등록</h3>
        
        {/* 담당자 선택 */}
        {currentUser?.role !== 'member' && (
          <div className="form-group">
            <label className="form-label">담당자</label>
            <select
              className="form-input"
              value={formData.assignee}
              onChange={(e) => handleFieldChange('assignee', e.target.value)}
              style={inputStyle}
            >
              {organization.departments[0]?.teams.flatMap(team => team.groups).map(group => (
                <optgroup key={group.id} label={group.name}>
                  {group.members.map(member => (
                    <option key={member.id} value={member.id}>
                      {`${member.name} (${member.position})`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="form-row">
          {/* Lv.1: 업무 카테고리 1 */}
          <div className="form-group">
            <label className="form-label">업무카테고리1 (과제유형)</label>
            <select
              className="form-input"
              value={formData.category1}
              onChange={(e) => handleFieldChange('category1', e.target.value)}
              style={inputStyle}
            >
              <option value="">선택하세요</option>
              {category1Options.map(cat => (
                <option key={cat} value={cat}>
                  {cat} {(categoryCodeMapping.category1 as any)[cat] 
                    ? ` (${(categoryCodeMapping.category1 as any)[cat]})` 
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lv.2: 업무 카테고리 2 (OBS 권한 필터링) */}
          <div className="form-group">
            <label className="form-label">업무카테고리2 (업무구분)</label>
            <select
              className="form-input"
              value={formData.category2}
              onChange={(e) => handleFieldChange('category2', e.target.value)}
              disabled={!formData.category1}
              style={!formData.category1 ? disabledStyle : inputStyle}
            >
              <option value="">
                {!formData.category1
                  ? "상위 항목을 선택하세요"
                  : authorizedLv2Keys.size === 0
                    ? "OBS에 배정된 업무가 없습니다"
                    : category2Options.length === 0
                      ? "해당 유형에 배정된 업무 없음"
                      : "선택하세요"}
              </option>
              {category2Options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lv.3: 업무 카테고리 3 */}
        <div className="form-group">
          <label className="form-label">업무카테고리3 (상세)</label>
          {category3Options.length > 0 ? (
            <select
              className="form-input"
              value={formData.category3}
              onChange={(e) => handleFieldChange('category3', e.target.value)}
              disabled={!formData.category2}
              style={!formData.category2 ? disabledStyle : inputStyle}
            >
              <option value="">
                {!formData.category2 ? "상위 항목을 선택하세요" : "선택하세요"}
              </option>
              {category3Options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="form-input"
              value={formData.category3}
              onChange={(e) => handleFieldChange('category3', e.target.value)}
              placeholder={formData.category2 ? "상세 내용을 직접 입력하세요" : "상위 항목 선택 필요"}
              disabled={!formData.category2}
              style={!formData.category2 ? disabledStyle : inputStyle}
            />
          )}
        </div>

        {/* Task명 */}
        <div className="form-group">
          <label className="form-label">Task명</label>
          <input
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            placeholder="Task명을 입력하세요"
            style={inputStyle}
          />
        </div>

        {/* 계획 기간 */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">계획 착수일</label>
            <input
              type="date"
              className="form-input"
              value={formData.plannedStart}
              onChange={(e) => handleFieldChange('plannedStart', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="form-group">
            <label className="form-label">계획 종료일</label>
            <input
              type="date"
              className="form-input"
              value={formData.plannedEnd}
              min={formData.plannedStart}
              onChange={(e) => handleFieldChange('plannedEnd', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* 시수 정보 */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">하루 예상 시수 (h)</label>
            <input
              type="number"
              className="form-input"
              value={formData.plannedDailyHours}
              onChange={(e) => handleFieldChange('plannedDailyHours', e.target.value)}
              placeholder="예: 4"
              style={inputStyle}
            />
          </div>
          <div className="form-group">
            <label className="form-label">계획 시수 (h)</label>
            <input
              type="number"
              className="form-input"
              value={formData.plannedHours}
              onChange={(e) => handleFieldChange('plannedHours', e.target.value)}
              placeholder="자동 계산 또는 직접 입력"
              style={inputStyle}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
