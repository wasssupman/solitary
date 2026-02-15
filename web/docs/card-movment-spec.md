# Card Movement Specification
- 클릭, 더블클릭, Drag & Drop 등 유저 인풋에 의해 카드 스택의 구조가 변경되는 상황에서 카드들에 대한 이동 연출 

---
## 구조 정의

CardData{
    // 이동할 개별 카드 정보
}

// 이동할 카드  정보
CardMovementData{
    from: 'tableau' | 'waste' | 'foundation' | 'stock';
    to: 'tableau' | 'waste' | 'foundation' | 'stock';
    CardData[] source;
    CardData[] destination;
    CardMovementImpl impl;
}

CardMovementImpl{
    CardMovementData data;
    abstract Execute(); --> 정해진 시간동안 카드 이동 연출 진행
    abstract FastForward(); --> 다음 인풋이 들어오면 즉시 결과 상태로 전이   
}
SineMovement: CardMovementImpl{
    Execute(){  
        
    }
    FastForward(){
        
    }
}
SpiralRotationMovement: CardMovementImpl{
    Execute(){
        
    }
    FastForward(){
        
    }
}

CardMovementRunner{
    CardMovementData data;
    CardMovementImpl impl;
}


## 구현 
- tableau -> foundation, tableau -> tableau,foundation -> tableau, stock -> tableau
    - DragEnd에서 CardMovementData생성 후 별도의 러너에서 카드 이동 연출 실행

## Requirement
- CardMovementImpl은 바꿔낄 수 있어야 함
- Runner에서 카드 이동로직을 분리하여 담당